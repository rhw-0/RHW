#!/usr/bin/env python3
"""Safely sync RHW's generated recipe catalog with Discovery public CFG data.

The script downloads into a temporary directory, validates the complete candidate,
compares it with the checked-in catalog and only then replaces generated assets.
It never commits, pushes, opens or merges a pull request; GitHub Actions owns the
review workflow around this deliberately local transformation.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import shutil
import tempfile
import time
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from build_recipe_catalog import build_catalog, read_catalog, write_catalog


ROOT = Path(__file__).resolve().parents[1]
CATALOG_DIR = ROOT / 'assets' / 'recipes'
STATUS_PATH = ROOT / 'assets' / 'discovery-status.json'
REPORT_PATH = ROOT / 'docs' / 'discovery-sync-report.md'
SOURCE_FILES = ('base_recipe_items.cfg', 'base_recipe_modules.cfg')
DEFAULT_SOURCE_BASES = (
    'https://discoverygc.com/gameconfigpublic/',
    'https://disco-api.dd84ai.com/gameconfigpublic/',
    'https://raw.githubusercontent.com/SlimyTheMoon/DiscoveryRecipieCalculator/main/Sources/',
)
DEPRECATED_RECIPE_IDS = {'module_m_hyperspace_scanner', 'module_m_cloakdisruptor'}
MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def _download(url: str, timeout: float = 35.0) -> bytes:
    request = Request(url, headers={
        'Accept': 'text/plain,application/octet-stream;q=0.9,*/*;q=0.2',
        'User-Agent': 'RHW-Discovery-Catalog-Sync/1.0 (+https://github.com/rhw-0/RHW)',
    })
    with urlopen(request, timeout=timeout) as response:
        content_type = response.headers.get('Content-Type', '')
        data = response.read(MAX_DOWNLOAD_BYTES + 1)
    if len(data) > MAX_DOWNLOAD_BYTES:
        raise ValueError(f'download exceeded {MAX_DOWNLOAD_BYTES} bytes')
    text = data.decode('utf-8', errors='replace').lower()
    if text.count('[recipe]') < 10 or 'nickname' not in text:
        raise ValueError(f'response is not a recipe CFG ({content_type or "unknown content type"})')
    return data


def fetch_source(filename: str, source_bases: Iterable[str], attempts: int = 2) -> tuple[bytes, str]:
    failures: list[str] = []
    for base in source_bases:
        url = urljoin(base.rstrip('/') + '/', filename)
        for attempt in range(1, attempts + 1):
            try:
                return _download(url), url
            except (HTTPError, URLError, TimeoutError, ValueError, OSError) as error:
                failures.append(f'{url} attempt {attempt}: {error}')
                if attempt < attempts:
                    time.sleep(min(attempt, 2))
    raise RuntimeError(f'Unable to download {filename}: ' + ' | '.join(failures))


def _entries(catalog: dict, key: str) -> dict[str, dict]:
    return {str(entry.get('id', '')): entry for entry in catalog.get(key, []) if entry.get('id')}


def catalog_diff(before: dict, after: dict) -> dict:
    result: dict[str, list[str]] = {}
    for key in ('recipes', 'products', 'factions'):
        old = _entries(before, key)
        new = _entries(after, key)
        result[f'{key}Added'] = sorted(new.keys() - old.keys())
        result[f'{key}Removed'] = sorted(old.keys() - new.keys())
        result[f'{key}Changed'] = sorted(
            entry_id for entry_id in old.keys() & new.keys()
            if json.dumps(old[entry_id], sort_keys=True, separators=(',', ':'))
            != json.dumps(new[entry_id], sort_keys=True, separators=(',', ':'))
        )
    return result


def has_catalog_changes(diff: dict) -> bool:
    return any(diff.get(key) for key in diff)


def effective_counts(catalog: dict) -> dict[str, int]:
    recipes = [recipe for recipe in catalog.get('recipes', []) if recipe.get('id') not in DEPRECATED_RECIPE_IDS]
    valid_recipe_ids = {recipe['id'] for recipe in recipes}
    products = {
        product['id']: {recipe_id for recipe_id in product.get('recipeIds', []) if recipe_id in valid_recipe_ids}
        for product in catalog.get('products', []) if product.get('id')
    }
    products = {product_id: recipe_ids for product_id, recipe_ids in products.items() if recipe_ids}
    for recipe in recipes:
        for group in recipe.get('affiliationOutputs', []):
            for output in (group.get('base'), group.get('alternate')):
                if output and output.get('id'):
                    products.setdefault(output['id'], set()).add(recipe['id'])
    return {
        'recipes': len(recipes),
        'products': len(products),
        'factions': len(catalog.get('factions', [])),
    }


def _positive_quantity(value: object) -> bool:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return False
    return math.isfinite(number) and number > 0


def validate_catalog(catalog: dict, min_recipes: int = 200, min_products: int = 150) -> list[str]:
    errors: list[str] = []
    recipes = catalog.get('recipes')
    products = catalog.get('products')
    factions = catalog.get('factions')
    if not isinstance(recipes, list) or len(recipes) < min_recipes:
        errors.append(f'recipe count is below the safety floor ({len(recipes or [])} < {min_recipes})')
        recipes = recipes if isinstance(recipes, list) else []
    if not isinstance(products, list) or len(products) < min_products:
        errors.append(f'product count is below the safety floor ({len(products or [])} < {min_products})')
        products = products if isinstance(products, list) else []
    if not isinstance(factions, list):
        errors.append('faction list is missing')
        factions = []

    for label, entries in (('recipe', recipes), ('product', products), ('faction', factions)):
        ids = [entry.get('id') for entry in entries if isinstance(entry, dict)]
        missing = len(entries) - sum(bool(entry_id) for entry_id in ids)
        duplicates = sorted({entry_id for entry_id in ids if entry_id and ids.count(entry_id) > 1})
        if missing:
            errors.append(f'{missing} {label} entries have no ID')
        if duplicates:
            errors.append(f'duplicate {label} IDs: {", ".join(duplicates[:12])}')

    faction_ids = {entry.get('id') for entry in factions}
    default_affiliation = catalog.get('meta', {}).get('defaultAffiliation')
    if default_affiliation and default_affiliation not in faction_ids:
        errors.append(f'default IFF {default_affiliation} is missing from factions')

    for recipe in recipes:
        recipe_id = recipe.get('id') or '<missing>'
        outputs = recipe.get('outputs', [])
        affiliation_outputs = recipe.get('affiliationOutputs', [])
        if not outputs and not affiliation_outputs:
            errors.append(f'{recipe_id}: recipe has no output')
        quantity_entries = list(outputs) + list(recipe.get('catalysts', []))
        for group in recipe.get('inputs', []):
            quantity_entries.extend(group.get('options', []))
        for group in affiliation_outputs:
            quantity_entries.extend(output for output in (group.get('base'), group.get('alternate')) if output)
            if not group.get('factionId'):
                errors.append(f'{recipe_id}: affiliation output has no faction ID')
        for entry in quantity_entries:
            if not entry.get('id'):
                errors.append(f'{recipe_id}: material or output has no ID')
            if not _positive_quantity(entry.get('qty')):
                errors.append(f'{recipe_id}: {entry.get("id") or "entry"} has invalid quantity {entry.get("qty")!r}')

    meta = catalog.get('meta', {})
    hashes = meta.get('sourceSha256', {})
    for filename in SOURCE_FILES:
        value = hashes.get(filename, '')
        if len(value) != 64 or any(char not in '0123456789abcdef' for char in value.lower()):
            errors.append(f'{filename}: missing or invalid SHA-256')
    return errors


def large_change_errors(before: dict, after: dict, diff: dict, max_ratio: float = 0.35) -> list[str]:
    errors: list[str] = []
    for key in ('recipes', 'products'):
        old_count = max(1, len(before.get(key, [])))
        new_count = len(after.get(key, []))
        ratio = abs(new_count - old_count) / old_count
        if ratio > max_ratio:
            errors.append(f'{key} count changed by {ratio:.1%} ({old_count} -> {new_count})')
    old_recipes = max(1, len(before.get('recipes', [])))
    touched = sum(len(diff.get(key, [])) for key in ('recipesAdded', 'recipesRemoved', 'recipesChanged'))
    if touched / old_recipes > max_ratio:
        errors.append(f'{touched / old_recipes:.1%} of recipes changed ({touched} of {old_recipes})')
    return errors


def _summary_counts(diff: dict) -> dict[str, int]:
    return {key: len(value) for key, value in diff.items()}


def make_status(catalog: dict, diff: dict, downloaded_from: dict[str, str], checked_at: str) -> dict:
    meta = catalog['meta']
    return {
        'schemaVersion': 1,
        'catalogState': 'verified',
        'catalogUpdatedAt': checked_at,
        'lastSuccessfulSync': checked_at,
        'source': {
            'canonicalUrl': meta['sourceUrl'],
            'files': meta['sourceFiles'],
            'downloadedFrom': downloaded_from,
            'sha256': meta['sourceSha256'],
        },
        'catalog': {
            'raw': {
                'recipes': meta['recipeCount'],
                'products': meta['productCount'],
                'factions': meta['factionCount'],
            },
            'effective': effective_counts(catalog),
        },
        'changes': _summary_counts(diff),
        'workflow': {
            'repository': 'rhw-0/RHW',
            'file': 'discovery-catalog-sync.yml',
            'reviewRequired': True,
            'autoMerge': False,
        },
    }


def _list_block(values: list[str], limit: int = 30) -> str:
    if not values:
        return '- None'
    lines = [f'- `{value}`' for value in values[:limit]]
    if len(values) > limit:
        lines.append(f'- …and {len(values) - limit} more')
    return '\n'.join(lines)


def make_report(before: dict, after: dict, diff: dict, status: dict) -> str:
    old_meta, new_meta = before.get('meta', {}), after.get('meta', {})
    source_lines = '\n'.join(
        f'- `{filename}`: `{new_meta.get("sourceSha256", {}).get(filename, "unknown")}`'
        for filename in SOURCE_FILES
    )
    sections = []
    for plural, label in (('recipes', 'Recipes'), ('products', 'Products'), ('factions', 'IFF profiles')):
        sections.append(
            f'### {label} added\n\n{_list_block(diff[f"{plural}Added"])}\n\n'
            f'### {label} removed\n\n{_list_block(diff[f"{plural}Removed"])}\n\n'
            f'### {label} changed\n\n{_list_block(diff[f"{plural}Changed"])}'
        )
    return f'''# Discovery catalog sync report

Generated: **{status['lastSuccessfulSync']}**

This report was generated from validated Discovery public recipe configuration. The automation may prepare a **Draft pull request**, but it never merges changes automatically.

## Validation result

- Catalog parser and structural validation: **passed**
- Review before merge: **required**
- Automatic merge: **disabled**
- Download sources: `{status['source']['downloadedFrom'][SOURCE_FILES[0]]}` and `{status['source']['downloadedFrom'][SOURCE_FILES[1]]}`

## Catalog totals

| Dataset | Before | Proposed | Effective in app |
| --- | ---: | ---: | ---: |
| Recipes | {old_meta.get('recipeCount', 0)} | {new_meta.get('recipeCount', 0)} | {status['catalog']['effective']['recipes']} |
| Products | {old_meta.get('productCount', 0)} | {new_meta.get('productCount', 0)} | {status['catalog']['effective']['products']} |
| IFF profiles | {old_meta.get('factionCount', 0)} | {new_meta.get('factionCount', 0)} | {status['catalog']['effective']['factions']} |

## Source integrity

{source_lines}

## Detailed changes

{(chr(10) * 2).join(sections)}
'''


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) + '\n', encoding='utf-8')


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-base', action='append', dest='source_bases', help='CFG base URL; may be repeated in fallback order.')
    parser.add_argument('--items-file', type=Path, help='Use a local base_recipe_items.cfg instead of downloading.')
    parser.add_argument('--modules-file', type=Path, help='Use a local base_recipe_modules.cfg instead of downloading.')
    parser.add_argument('--catalog-dir', type=Path, default=CATALOG_DIR)
    parser.add_argument('--status-path', type=Path, default=STATUS_PATH)
    parser.add_argument('--report-path', type=Path, default=REPORT_PATH)
    parser.add_argument('--chunks', type=int, default=6)
    parser.add_argument('--min-recipes', type=int, default=200)
    parser.add_argument('--min-products', type=int, default=150)
    parser.add_argument('--max-change-ratio', type=float, default=0.35)
    parser.add_argument('--allow-large-change', action='store_true', help='Allow a deliberately reviewed change beyond the ratio gate.')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--timestamp', help='Override the UTC status timestamp (tests/reproducible runs).')
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if bool(args.items_file) != bool(args.modules_file):
        raise SystemExit('--items-file and --modules-file must be supplied together')
    before = read_catalog(args.catalog_dir)
    checked_at = args.timestamp or utc_now()

    with tempfile.TemporaryDirectory(prefix='rhw-discovery-sync-') as folder:
        temp = Path(folder)
        downloaded_from: dict[str, str] = {}
        if args.items_file:
            sources = (args.items_file, args.modules_file)
            for filename, source in zip(SOURCE_FILES, sources, strict=True):
                target = temp / filename
                shutil.copyfile(source, target)
                downloaded_from[filename] = source.resolve().as_uri()
        else:
            bases = tuple(args.source_bases or DEFAULT_SOURCE_BASES)
            for filename in SOURCE_FILES:
                data, url = fetch_source(filename, bases)
                (temp / filename).write_bytes(data)
                downloaded_from[filename] = url

        after = build_catalog(temp / SOURCE_FILES[0], temp / SOURCE_FILES[1])
        errors = validate_catalog(after, args.min_recipes, args.min_products)
        if errors:
            raise SystemExit('Discovery catalog validation failed:\n- ' + '\n- '.join(errors))
        diff = catalog_diff(before, after)

        if not has_catalog_changes(diff):
            print('Discovery catalog is unchanged; no generated files or status timestamps were touched.')
            return 0

        gate_errors = large_change_errors(before, after, diff, args.max_change_ratio)
        if gate_errors and not args.allow_large_change:
            raise SystemExit(
                'Discovery catalog change exceeded the safety gate:\n- '
                + '\n- '.join(gate_errors)
                + '\nRe-run manually with --allow-large-change only after reviewing the upstream change.'
            )

        status = make_status(after, diff, downloaded_from, checked_at)
        report = make_report(before, after, diff, status)
        counts = _summary_counts(diff)
        print('Validated Discovery change: ' + ', '.join(f'{key}={value}' for key, value in counts.items()))
        if args.dry_run:
            print(report)
            return 0

        write_catalog(after, args.catalog_dir, args.chunks)
        write_json(args.status_path, status)
        args.report_path.parent.mkdir(parents=True, exist_ok=True)
        args.report_path.write_text(report, encoding='utf-8')
        print(f'Updated catalog, {args.status_path} and {args.report_path}. Human review is required.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
