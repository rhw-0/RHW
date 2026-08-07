#!/usr/bin/env python3
"""Dependency-free structural checks for the static RHW dashboard and V4 web app."""
from __future__ import annotations

from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'index.html'

EXPECTED_CSS = [
    './css/01-core.css', './css/02-ticker.css', './css/03-production.css', './css/04-responsive.css',
    './css/05-shipyard.css', './css/06-shipyard-detail.css', './css/07-mobile.css', './css/08-headings.css',
    './css/09-v35.css', './css/10-maintenance.css', './css/11-layout-v36.css',
]
EXPECTED_JS = [
    './js/config.js', './js/00-bootstrap.js', './js/01-wire.js', './js/02-utils.js', './js/03-telemetry.js',
    './js/04-state-production.js', './js/05-shipyard.js', './js/06-logistics.js', './js/07-overview.js',
    './js/08-data.js', './js/09-newswire.js', './js/10-maintenance.js', './js/11-layout-v36.js',
]
V4_RUNTIME_ASSETS = [
    './css/12-app-v40.css', './css/13-app-v40-navigation.css', './css/14-app-v40-composer.css',
    './css/15-app-v40-audit.css', './css/16-app-v40-operations.css',
    './js/12-app-config.js', './js/13-app-v40.js', './js/14-app-v40-cache.js', './js/15-app-v40-navigation.js',
    './js/16-app-v40-composer.js',
    './assets/recipes/catalog-v1-part-01.js', './assets/recipes/catalog-v1-part-02.js', './assets/recipes/catalog-v1-part-03.js',
    './assets/recipes/catalog-v1-part-04.js', './assets/recipes/catalog-v1-part-05.js', './assets/recipes/catalog-v1-part-06.js',
    './js/17-app-v40-operations-core.js', './js/18-app-v40-operations-ui.js', './js/19-app-v40-runtime.js',
]
V4_SUPPORT_ASSETS = ['./scripts/build_recipe_catalog.py', './scripts/smoke_v40.py']


class DashboardParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.css: list[str] = []
        self.js: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if values.get('id'):
            self.ids.append(values['id'] or '')
        if tag == 'link' and values.get('rel') == 'stylesheet' and values.get('href', '').startswith('./css/'):
            self.css.append(values['href'] or '')
        if tag == 'script' and values.get('src', '').startswith('./js/'):
            self.js.append(values['src'] or '')


def require_tokens(errors: list[str], path: str, tokens: tuple[str, ...], label: str) -> None:
    text = (ROOT / path).read_text(encoding='utf-8')
    for token in tokens:
        if token not in text:
            errors.append(f'{label} is incomplete: {token}')


def main() -> int:
    errors: list[str] = []
    if not INDEX.exists():
        print('ERROR: index.html is missing', file=sys.stderr)
        return 1

    parser = DashboardParser()
    parser.feed(INDEX.read_text(encoding='utf-8'))
    if parser.css != EXPECTED_CSS:
        errors.append('Stylesheet load order differs from the documented RHW order.')
    if parser.js != EXPECTED_JS:
        errors.append('JavaScript load order differs from the documented RHW order.')

    for ref in [*parser.css, *parser.js, *V4_RUNTIME_ASSETS, *V4_SUPPORT_ASSETS, './assets/RHW_Newswire.md']:
        if not (ROOT / ref.removeprefix('./')).is_file():
            errors.append(f'Referenced local file is missing: {ref}')

    duplicate_ids = sorted(key for key, count in Counter(parser.ids).items() if count > 1)
    if duplicate_ids:
        errors.append('Duplicate HTML id values: ' + ', '.join(duplicate_ids))

    config = (ROOT / 'js/config.js').read_text(encoding='utf-8')
    if 'baseHealthMax:' not in config:
        errors.append('js/config.js must define baseHealthMax.')

    require_tokens(errors, 'js/11-layout-v36.js', ('arrangeV36CommandFlow', 'initProductionDetailsToggle'), 'V3.6 layout controls')

    bootstrap = (ROOT / 'js/00-bootstrap.js').read_text(encoding='utf-8')
    for required in V4_RUNTIME_ASSETS:
        if required not in bootstrap:
            errors.append(f'V4 bootstrap does not reference required asset: {required}')

    require_tokens(errors, 'js/12-app-config.js', (
        "RHW_APP_VERSION = 'V4.0 PREVIEW'", 'alistair-thorne', 'salutations:', 'closings:',
        'operationsNode:', 'calculatorState:', 'defaultAffiliation:', 'shipyardTargets:'
    ), 'V4 configuration')
    require_tokens(errors, 'js/13-app-v40.js', (
        'window.RHWV4', "'operations'", 'workspaceOperations', 'app.installShell', 'app.navigate', 'app.applyRoute'
    ), 'V4 core')
    require_tokens(errors, 'js/14-app-v40-cache.js', ('app.storage', 'saveDraft', 'upsertSender', 'importPayload', 'senderSnapshotName'), 'V4 storage')
    require_tokens(errors, 'js/15-app-v40-navigation.js', (
        'PRIORITY ACTIONS', 'inventory-view-nav', 'priorityActions', 'activateInventoryView',
        "typeof CAPITAL_SHIPYARD === 'undefined'", "typeof RECIPES === 'undefined'"
    ), 'V4 COMMAND module')
    require_tokens(errors, 'js/16-app-v40-composer.js', ('SALUTATION / OPENING', 'comms-editor-toolbar', 'ticker-builder-preview', 'data-edit-sender', 'buildBbcode'), 'V4 COMMS module')
    require_tokens(errors, 'js/17-app-v40-operations-core.js', ('app.operationsCore', 'loadCatalog', 'buildPlan', 'factorFor', 'outputPerCycle: rootOutputPerCycle'), 'V4 OPERATIONS planner')
    require_tokens(errors, 'js/18-app-v40-operations-ui.js', (
        'ITEM CALCULATOR', 'SEARCH RECIPE', 'PRICE / UNIT', 'TARGET PROFIT MARGIN', 'materialPrices',
        'NO MATCHING RECIPE', 'Math.ceil(unitCost', 'installShipyardBridge', 'PRICE / PLAN 1 HULL'
    ), 'V4 OPERATIONS UI')
    require_tokens(errors, 'js/19-app-v40-runtime.js', ('workspaceOperations', 'operations-calculator', '__RHW_V4_SMOKE__', 'app.runtime'), 'V4 runtime')
    for idx in range(1, 7):
        require_tokens(errors, f'assets/recipes/catalog-v1-part-{idx:02d}.js', ('__RHW_RECIPE_CATALOG_GZIP_BASE64__',), f'V4 recipe catalog chunk {idx}')

    command_ui = (ROOT / 'js/15-app-v40-navigation.js').read_text(encoding='utf-8')
    if 'window.RECIPES' in command_ui or 'window.CAPITAL_SHIPYARD' in command_ui:
        errors.append('V4 COMMAND must not probe stable lexical const values through window.*.')

    operations_ui = (ROOT / 'js/18-app-v40-operations-ui.js').read_text(encoding='utf-8')
    if 'RECIPE VARIANT' in operations_ui:
        errors.append('V4 Item Calculator must not expose the obsolete RECIPE VARIANT control.')
    if 'ALTERNATIVE INPUTS' in operations_ui or '.ops-alternatives' in operations_ui:
        errors.append('V4 Item Calculator must not expose alternative-input routing in simple costing mode.')

    operations_css = (ROOT / 'css/16-app-v40-operations.css').read_text(encoding='utf-8')
    if re.search(r'(^|})\.(good|warn)\{', operations_css):
        errors.append('V4 OPERATIONS status colors leak through unscoped global .good/.warn selectors.')

    if (ROOT / 'js/17-app-v40-audit.js').exists():
        errors.append('Obsolete duplicate V4 runtime file js/17-app-v40-audit.js must not be present.')

    for path in (
        'js/13-app-v40.js', 'js/14-app-v40-cache.js', 'js/15-app-v40-navigation.js',
        'js/16-app-v40-composer.js', 'js/17-app-v40-operations-core.js', 'js/18-app-v40-operations-ui.js', 'js/19-app-v40-runtime.js'
    ):
        text = (ROOT / path).read_text(encoding='utf-8')
        if 'BaseApply' in text or 'BaseActivate' in text or 'const v40Base' in text:
            errors.append(f'V4 module still contains legacy override-chain hooks: {path}')

    readme = (ROOT / 'README.md').read_text(encoding='utf-8')
    if '.github/workflows/rhw-pages-deploy.yml' not in readme:
        errors.append('README deployment documentation does not name the active workflow.')

    if errors:
        for message in errors:
            print(f'ERROR: {message}', file=sys.stderr)
        return 1

    print(
        f'RHW validation passed: {len(parser.css)} static stylesheets, {len(parser.js)} static scripts, '
        f'{len(V4_RUNTIME_ASSETS)} V4 runtime assets, {len(parser.ids)} unique static ids.'
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
