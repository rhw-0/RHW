#!/usr/bin/env python3
"""Build the RHW V4 browser recipe catalog from Discovery public CFG files."""
from __future__ import annotations

import argparse
import base64
from collections import defaultdict
import gzip
import hashlib
import json
from pathlib import Path
import re


def split_value_comment(raw: str) -> tuple[str, str]:
    if ';' in raw:
        value, comment = raw.split(';', 1)
        return value.strip(), comment.strip()
    return raw.strip(), ''


def parse_cfg(path: Path, source_type: str) -> list[dict]:
    recipes: list[dict] = []
    current: dict | None = None
    for raw in path.read_text(encoding='utf-8', errors='replace').splitlines():
        line = raw.strip()
        if not line or line.startswith(';'):
            continue
        if line.startswith('[') and line.endswith(']'):
            if current and current.get('nickname'):
                recipes.append(current)
            current = {'sourceType': source_type} if line.lower() == '[recipe]' else None
            continue
        if current is None or '=' not in line:
            continue
        key, raw_value = line.split('=', 1)
        key = key.strip()
        value, comment = split_value_comment(raw_value)
        if key in {'nickname', 'infotext', 'craft_type', 'build_type', 'craft_list'}:
            current[key] = value
        elif key in {'cooking_rate', 'reqlevel', 'loop_production', 'recipe_number', 'module_class', 'credit_cost', 'cargo_storage'}:
            try:
                current[key] = float(value) if '.' in value else int(value)
            except ValueError:
                current[key] = value
        elif key == 'restricted':
            current[key] = value.lower() in {'true', '1', 'yes'}
        elif key in {'produced_item', 'consumed', 'catalyst', 'affiliation_bonus', 'consumed_dynamic_alt', 'consumed_dynamic', 'produced_affiliation'}:
            current.setdefault(key, []).append((value, comment))
    if current and current.get('nickname'):
        recipes.append(current)
    return recipes


def tokens(value: str) -> list[str]:
    return [part.strip() for part in value.split(',') if part.strip()]


def clean_name(value: str | None) -> str:
    return re.sub(r'\s+Assembly$', '', (value or '').strip(), flags=re.I)


def item(item_id: str, qty: str | int | float, name: str = '') -> dict:
    try:
        quantity = float(qty)
        if quantity.is_integer():
            quantity = int(quantity)
    except (TypeError, ValueError):
        quantity = 1
    return {'id': item_id, 'name': name or item_id, 'qty': quantity}


def build_catalog(items_path: Path, modules_path: Path) -> dict:
    raw_recipes = parse_cfg(items_path, 'item') + parse_cfg(modules_path, 'module')
    faction_names: dict[str, str] = {}
    product_names: dict[str, str] = {}
    normalized: list[dict] = []

    for raw in raw_recipes:
        recipe_id = raw['nickname']
        outputs: list[dict] = []
        for value, comment in raw.get('produced_item', []):
            parts = tokens(value)
            if not parts:
                continue
            outputs.append(item(parts[0], parts[1] if len(parts) > 1 else 1, clean_name(comment)))
        if not outputs and raw['sourceType'] == 'module':
            outputs = [item(recipe_id, 1, clean_name(raw.get('infotext')) or recipe_id)]

        affiliation_outputs: list[dict] = []
        for value, _comment in raw.get('produced_affiliation', []):
            parts = tokens(value)
            if len(parts) >= 5:
                base_id, base_qty, faction_id, alt_id, alt_qty = parts[:5]
                affiliation_outputs.append({
                    'factionId': faction_id,
                    'base': item(base_id, base_qty),
                    'alternate': item(alt_id, alt_qty),
                })
                if not outputs:
                    outputs = [item(base_id, base_qty, clean_name(raw.get('infotext')) or base_id)]
        if not outputs:
            continue

        info_name = clean_name(raw.get('infotext'))
        if info_name:
            outputs[0]['name'] = info_name
        for output in outputs:
            product_names[output['id']] = output['name']

        inputs: list[dict] = []
        for value, comment in raw.get('consumed', []):
            parts = tokens(value)
            if len(parts) >= 2:
                entry = item(parts[0], parts[1], clean_name(comment))
                product_names.setdefault(entry['id'], entry['name'])
                inputs.append({'kind': 'consumed', 'options': [entry]})

        for value, comment in raw.get('consumed_dynamic_alt', []):
            parts = tokens(value)
            names = [part.strip() for part in comment.split(',')] if comment else []
            if len(parts) >= 2:
                quantity = parts[0]
                options = []
                for index, item_id in enumerate(parts[1:]):
                    entry = item(item_id, quantity, names[index] if index < len(names) else item_id)
                    product_names.setdefault(item_id, entry['name'])
                    options.append(entry)
                inputs.append({'kind': 'alternative', 'options': options})

        for value, comment in raw.get('consumed_dynamic', []):
            parts = tokens(value)
            names = [part.strip() for part in comment.split(',')] if comment else []
            options = []
            for index in range(0, len(parts) - 1, 2):
                entry = item(parts[index], parts[index + 1], names[index // 2] if index // 2 < len(names) else parts[index])
                product_names.setdefault(entry['id'], entry['name'])
                options.append(entry)
            if options:
                inputs.append({'kind': 'dynamic', 'options': options})

        catalysts: list[dict] = []
        for value, comment in raw.get('catalyst', []):
            parts = tokens(value)
            if len(parts) >= 2:
                entry = item(parts[0], parts[1], clean_name(comment))
                product_names.setdefault(entry['id'], entry['name'])
                catalysts.append(entry)

        bonuses: list[dict] = []
        for value, comment in raw.get('affiliation_bonus', []):
            parts = tokens(value)
            if len(parts) >= 2:
                try:
                    factor = float(parts[1])
                except ValueError:
                    factor = 1.0
                name = clean_name(comment) or parts[0]
                bonuses.append({'id': parts[0], 'name': name, 'factor': factor})
                faction_names[parts[0]] = name

        normalized.append({
            'id': recipe_id,
            'name': info_name or outputs[0]['name'] or recipe_id,
            'sourceType': raw['sourceType'],
            'craftType': raw.get('craft_type') or raw.get('build_type') or raw.get('craft_list') or '',
            'cookingRate': raw.get('cooking_rate', 0),
            'reqLevel': raw.get('reqlevel', 0),
            'restricted': bool(raw.get('restricted', False)),
            'loopProduction': raw.get('loop_production'),
            'moduleClass': raw.get('module_class'),
            'creditCost': raw.get('credit_cost'),
            'outputs': outputs,
            'inputs': inputs,
            'catalysts': catalysts,
            'bonuses': bonuses,
            'affiliationOutputs': affiliation_outputs,
        })

    recipes_by_product: dict[str, list[str]] = defaultdict(list)
    for recipe in normalized:
        for output in recipe['outputs']:
            recipes_by_product[output['id']].append(recipe['id'])

    products = [
        {'id': product_id, 'name': product_names.get(product_id, product_id), 'recipeIds': recipe_ids}
        for product_id, recipe_ids in recipes_by_product.items()
    ]
    products.sort(key=lambda entry: (entry['name'].lower(), entry['id']))
    factions = [
        {'id': faction_id, 'name': name}
        for faction_id, name in sorted(faction_names.items(), key=lambda pair: (pair[1].lower(), pair[0]))
    ]

    return {
        'meta': {
            'schemaVersion': 1,
            'sourceUrl': 'https://discoverygc.com/gameconfigpublic/',
            'sourceFiles': [items_path.name, modules_path.name],
            'recipeCount': len(normalized),
            'productCount': len(products),
            'factionCount': len(factions),
            'defaultAffiliation': 'br_m_grp',
            'generatedFor': 'RHW V4.0 PREVIEW',
            'sourceSha256': {
                items_path.name: hashlib.sha256(items_path.read_bytes()).hexdigest(),
                modules_path.name: hashlib.sha256(modules_path.read_bytes()).hexdigest(),
            },
        },
        'products': products,
        'recipes': normalized,
        'factions': factions,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('items_cfg', type=Path)
    parser.add_argument('modules_cfg', type=Path)
    parser.add_argument('--output-dir', type=Path, default=Path('assets/recipes'))
    parser.add_argument('--chunk-size', type=int, default=6000)
    args = parser.parse_args()

    catalog = build_catalog(args.items_cfg, args.modules_cfg)
    raw = json.dumps(catalog, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    compressed = gzip.compress(raw, compresslevel=9, mtime=0)
    encoded = base64.b64encode(compressed).decode('ascii')
    args.output_dir.mkdir(parents=True, exist_ok=True)
    chunk_size = max(1000, args.chunk_size)
    chunks = [encoded[i:i + chunk_size] for i in range(0, len(encoded), chunk_size)]

    for stale in args.output_dir.glob('catalog-v1-part-*.js'):
        stale.unlink()
    for index, chunk in enumerate(chunks, 1):
        path = args.output_dir / f'catalog-v1-part-{index:02d}.js'
        path.write_text(
            '/* RHW V4 recipe catalog chunk. Generated; do not hand-edit. */\n'
            "window.__RHW_RECIPE_CATALOG_GZIP_BASE64__ = (window.__RHW_RECIPE_CATALOG_GZIP_BASE64__ || '') + "
            + repr(chunk) + ';\n',
            encoding='utf-8',
        )

    print(
        f"Built {catalog['meta']['recipeCount']} recipes, "
        f"{catalog['meta']['productCount']} products and {catalog['meta']['factionCount']} IFF profiles "
        f"into {len(chunks)} deterministic catalog chunks -> {args.output_dir}"
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
