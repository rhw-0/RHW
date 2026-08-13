#!/usr/bin/env python3
"""Dependency-free unit coverage for the review-gated Discovery sync."""
from __future__ import annotations

from pathlib import Path
import tempfile

from build_recipe_catalog import build_catalog, read_catalog, write_catalog
from sync_discovery_catalog import (
    catalog_diff,
    effective_counts,
    has_catalog_changes,
    large_change_errors,
    make_report,
    make_status,
    validate_catalog,
)


ITEMS = '''
[Recipe]
nickname = recipe_test_plate
produced_item = commodity_test_plate, 2 ; Test Plate Assembly
consumed = commodity_ore, 4 ; Test Ore
affiliation_bonus = br_m_grp, 0.8 ; BMM
'''

MODULES = '''
[Recipe]
nickname = module_test_reactor
infotext = Test Reactor Assembly
consumed = commodity_test_plate, 3 ; Test Plate
restricted = true
affiliation_bonus = br_m_grp, 1 ; BMM
'''


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    with tempfile.TemporaryDirectory(prefix='rhw-discovery-test-') as folder:
        root = Path(folder)
        items = root / 'base_recipe_items.cfg'
        modules = root / 'base_recipe_modules.cfg'
        output = root / 'catalog'
        items.write_text(ITEMS, encoding='utf-8')
        modules.write_text(MODULES, encoding='utf-8')

        baseline = build_catalog(items, modules)
        errors = validate_catalog(baseline, min_recipes=2, min_products=2)
        require(not errors, f'valid fixture rejected: {errors}')
        paths = write_catalog(baseline, output, 6)
        require(len(paths) == 6, 'catalog must contain exactly six chunks')
        first_bytes = [path.read_bytes() for path in paths]
        require(read_catalog(output) == baseline, 'generated catalog did not round-trip')
        require([path.read_bytes() for path in write_catalog(baseline, output, 6)] == first_bytes, 'catalog output is not deterministic')

        modules.write_text(MODULES.replace('commodity_test_plate, 3', 'commodity_test_plate, 4'), encoding='utf-8')
        candidate = build_catalog(items, modules)
        diff = catalog_diff(baseline, candidate)
        require(has_catalog_changes(diff), 'recipe quantity change was not detected')
        require(diff['recipesChanged'] == ['module_test_reactor'], f'unexpected recipe diff: {diff}')
        require(not diff['recipesAdded'] and not diff['recipesRemoved'], f'false add/remove diff: {diff}')
        require(large_change_errors(baseline, candidate, diff, max_ratio=.35), 'large-change review gate did not trigger')

        status = make_status(candidate, diff, {
            'base_recipe_items.cfg': items.resolve().as_uri(),
            'base_recipe_modules.cfg': modules.resolve().as_uri(),
        }, '2026-08-13T00:00:00Z')
        report = make_report(baseline, candidate, diff, status)
        require(status['workflow']['autoMerge'] is False, 'status must forbid automatic merge')
        require(effective_counts(candidate)['recipes'] == 2, 'effective recipe count mismatch')
        require('module_test_reactor' in report and 'Automatic merge: **disabled**' in report, 'review report is incomplete')

        broken = {**candidate, 'recipes': [*candidate['recipes'], candidate['recipes'][0]]}
        require(any('duplicate recipe IDs' in error for error in validate_catalog(broken, 2, 2)), 'duplicate recipe ID passed validation')

    print('Discovery sync tests passed: deterministic build, validation, diff, safety gate and review report.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
