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
    './css/15-app-v40-audit.css', './css/16-app-v40-operations.css', './css/17-app-v40-calculator-polish.css',
    './css/18-app-v40-nav-hierarchy.css', './css/19-app-v402-fixes.css', './css/20-app-v402-qol.css',
    './css/21-app-v402-mobile-ui.css', './css/22-app-pr3-command-mobile.css', './css/23-app-pr3-yard-production.css',
    './css/24-app-pr3-operations-calculator.css', './css/25-app-pr3-comms-workflow.css',
    './js/12-app-config.js', './js/13-app-v40.js', './js/14-app-v40-cache.js', './js/15-app-v40-navigation.js',
    './js/16-app-v40-composer.js', './js/16a-app-v40-comms-safety.js', './js/16b-app-v40-newswire-manager.js',
    './js/16c-app-v40-newswire-ordering.js',
    './assets/recipes/catalog-v1-part-01.js', './assets/recipes/catalog-v1-part-02.js', './assets/recipes/catalog-v1-part-03.js',
    './assets/recipes/catalog-v1-part-04.js', './assets/recipes/catalog-v1-part-05.js', './assets/recipes/catalog-v1-part-06.js',
    './js/17-app-v40-operations-core.js', './js/18-app-v40-operations-ui.js', './js/18a-app-v40-nav-hierarchy.js',
    './js/18b-app-v40-production-pricing.js', './js/18c-app-v40-recipe-corrections.js',
    './js/18d-app-v40-final-ui-polish.js', './js/20-app-v402-fixes.js', './js/21-app-v402-qol.js',
    './js/22-app-v402-mobile-ui.js', './js/19-app-v40-runtime.js',
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

    app_config = (ROOT / 'js/12-app-config.js').read_text(encoding='utf-8')
    version_match = re.search(r"RHW_APP_VERSION\s*=\s*'([^']+)'", app_config)
    version = version_match.group(1) if version_match else ''
    if not re.fullmatch(r'V4\.\d+(?:\.\d+)?(?: PREVIEW)?', version):
        errors.append(f'V4 configuration has an invalid RHW_APP_VERSION: {version or "MISSING"}')

    require_tokens(errors, 'js/12-app-config.js', (
        'alistair-thorne', 'salutations:', 'closings:',
        'operationsNode:', 'calculatorState:', 'defaultAffiliation:', 'shipyardTargets:',
        'newswireManagerDraft:', 'commsMobileView:'
    ), 'V4 configuration')
    require_tokens(errors, 'js/13-app-v40.js', (
        'window.RHWV4', "'operations'", 'workspaceOperations', 'app.installShell', 'app.navigate', 'app.applyRoute'
    ), 'V4 core')
    require_tokens(errors, 'js/14-app-v40-cache.js', (
        'app.storage', 'saveDraft', 'upsertSender', 'importPayload', 'senderSnapshotName',
        "version: 2", 'priceProfiles:', 'shipyardPlanner:', 'newswireDraft:', 'preferences:'
    ), 'V4 storage')
    require_tokens(errors, 'js/15-app-v40-navigation.js', (
        'PRIORITY ACTIONS', 'inventory-view-nav', 'priorityActions', 'activateInventoryView',
        "typeof CAPITAL_SHIPYARD === 'undefined'", "typeof RECIPES === 'undefined'"
    ), 'V4 COMMAND module')
    require_tokens(errors, 'js/16-app-v40-composer.js', ('SALUTATION / OPENING', 'comms-editor-toolbar', 'ticker-builder-preview', 'data-edit-sender', 'buildBbcode'), 'V4 COMMS module')
    require_tokens(errors, 'js/16a-app-v40-comms-safety.js', (
        'MAX_TAG = 40', 'MAX_MESSAGE = 240', 'normalizeTag', 'normalizeMessage', 'app.commsSafety'
    ), 'V4 COMMS safety module')
    require_tokens(errors, 'js/16b-app-v40-newswire-manager.js', (
        'newswireManagerDraft', 'readLocalDraft', 'draftSourceChanged', 'beforeunload', 'restoreDraft'
    ), 'V4 Newswire recovery')
    require_tokens(errors, 'js/00-bootstrap.js', (
        'rhwBootFailure', 'rhwBootError', 'LOAD TIMEOUT', '__RHW_BOOTSTRAP_TEST__',
        './css/21-app-v402-mobile-ui.css', './css/23-app-pr3-yard-production.css',
        './css/24-app-pr3-operations-calculator.css', './css/25-app-pr3-comms-workflow.css',
        './js/22-app-v402-mobile-ui.js'
    ), 'V4 bootstrap failure UI')
    require_tokens(errors, 'js/22-app-v402-mobile-ui.js', (
        'commsMobileView', 'setForumView', 'commsMobileViewSwitch', "['write', 'preview', 'bbcode']"
    ), 'V4 mobile UI')
    require_tokens(errors, 'css/21-app-v402-mobile-ui.css', (
        'env(safe-area-inset-bottom', 'position: fixed', 'min-height: 44px',
        'data-comms-mobile-view="write"', 'data-comms-mobile-view="preview"', 'data-comms-mobile-view="bbcode"'
    ), 'V4 mobile presentation')
    require_tokens(errors, 'js/04-state-production.js', (
        'productionModuleFilter', 'applyProductionModuleFilters', 'data-production-filter', 'production-card-toggle'
    ), 'PR3 Production decision controls')
    require_tokens(errors, 'js/05-shipyard.js', (
        'shipyard-decision-strip', 'MISSING FOR NEXT HULL', 'data-label="REQ / HULL"'
    ), 'PR3 Shipyard decision summary')
    require_tokens(errors, 'css/23-app-pr3-yard-production.css', (
        '.shipyard-decision-strip', '.production-module-tools', '.production-card-toggle',
        'min-height: 44px', 'orientation: landscape'
    ), 'PR3 Shipyard + Production UI')
    require_tokens(errors, 'css/24-app-pr3-operations-calculator.css', (
        '.ops-mobile-decision', '.ops-material-row', '.ops-profile-actions button',
        'min-height: 44px', 'overflow: visible', '@media (max-width: 390px)'
    ), 'PR3 Calculator mobile presentation')
    require_tokens(errors, 'js/16-app-v40-composer.js', (
        'commsWorkflowStatus', 'commsMessageCount', 'data-comms-surface="preview"',
        'data-copy-forum-bbcode', 'comms-archive-summary', 'ACTIVE PROFILE'
    ), 'PR3 COMMS workflow')
    require_tokens(errors, 'css/25-app-pr3-comms-workflow.css', (
        '.comms-workflow-status', '.comms-surface-actions', '.comms-archive-summary',
        '.sender-registry-card.active', '.v40-newswire-file-actions button',
        'min-height: 44px', '@media (max-width: 390px)'
    ), 'PR3 COMMS mobile presentation')
    require_tokens(errors, 'scripts/smoke_v402.py', (
        'MOBILE_WIDTHS = (360, 390, 412, 430)', 'test_boot_failure',
        'test_backup_and_storage', 'test_mobile_forum_controls', 'test_pr3_decision_ui',
        'test_pr3_calculator_ui', 'test_pr3_comms_workflow', 'take_runtime_failures'
    ), 'V4.0.2 + PR1 browser smoke')
    require_tokens(errors, 'js/17-app-v40-operations-core.js', (
        'app.operationsCore', 'loadCatalog', 'buildPlan', 'factorFor', 'authorizedFor',
        'RESTRICTED RECIPE REQUIRES AN AUTHORIZED IFF', 'outputPerCycle: rootOutputPerCycle'
    ), 'V4 OPERATIONS planner')
    require_tokens(errors, 'js/18-app-v40-operations-ui.js', (
        'ITEM CALCULATOR', 'SEARCH RECIPE', 'PRICE / UNIT', 'TARGET PROFIT MARGIN', 'materialPrices',
        'NO MATCHING RECIPE', 'Math.ceil(unitCost', 'AUTHORIZED IFF', 'RESTRICTED RECIPE',
        'installShipyardBridge', 'PRICE / PLAN 1 HULL', 'ops-mobile-decision',
        'data-ops-quantity', 'data-ops-jump', 'opsMobileSellUnit'
    ), 'V4 OPERATIONS UI')
    require_tokens(errors, 'js/19-app-v40-runtime.js', (
        'workspaceOperations', 'operations-calculator', '__RHW_V4_SMOKE__', 'app.commsSafety?.init()', 'app.runtime'
    ), 'V4 runtime')
    require_tokens(errors, 'scripts/build_recipe_catalog.py', (
        "parser.add_argument('--chunks'", 'chunk_count = max(1, int(args.chunks))', "if ''.join(chunks) != encoded"
    ), 'Recipe catalog builder')
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
        'js/16-app-v40-composer.js', 'js/16a-app-v40-comms-safety.js', 'js/17-app-v40-operations-core.js',
        'js/18-app-v40-operations-ui.js', 'js/19-app-v40-runtime.js'
    ):
        text = (ROOT / path).read_text(encoding='utf-8')
        if 'BaseApply' in text or 'BaseActivate' in text or 'const v40Base' in text:
            errors.append(f'V4 module still contains legacy override-chain hooks: {path}')

    if 'catalogAsset:' in app_config:
        errors.append('V4 configuration must not reference the removed single-file recipe catalog asset.')

    require_tokens(errors, 'js/20-app-v402-fixes.js', (
        'v40OverviewTelemetryState', "'CACHE TELEMETRY'", "'AWAITING TELEMETRY'",
        'price per unit', 'Generated Newswire source block', 'Updated RHW Newswire Markdown source'
    ), 'V4.0.2 runtime fixes')
    require_tokens(errors, 'js/03-telemetry.js', (
        'NO VERIFIED CACHE AVAILABLE // WAITING FOR FIRST SUCCESSFUL SYNC',
    ), 'Telemetry cache fallback')
    require_tokens(errors, 'css/19-app-v402-fixes.css', (
        '@media (max-width: 700px)', '.crest-frame.crest-fallback::after', 'width: 72px', 'height: 72px',
        '.command-overview-live[data-state="stale"]', '.command-overview-live[data-state="offline"]'
    ), 'V4.0.2 presentation fixes')

    index_text = INDEX.read_text(encoding='utf-8')
    title_match = re.search(r'<title>(.*?)</title>', index_text, flags=re.I | re.S)
    if not title_match or version not in title_match.group(1):
        errors.append(f'index.html title does not advertise the current app version {version}.')

    revision_match = re.search(r"RHW_V4_ASSET_REV\s*=\s*'([^']+)'", bootstrap)
    release_number = version.removeprefix('V')
    if not revision_match or not revision_match.group(1).startswith(f'{release_number}-'):
        errors.append(f'V4 cache-busting revision is not aligned with app version {version}.')

    readme = (ROOT / 'README.md').read_text(encoding='utf-8')
    if f'# Resolution Heavy Works Web App - {version}' not in readme or f'{version} is the current RHW web app release.' not in readme:
        errors.append(f'README release metadata does not match current app version {version}.')
    if '.github/workflows/rhw-pages-deploy.yml' not in readme:
        errors.append('README deployment documentation does not name the active workflow.')

    if errors:
        for message in errors:
            print(f'ERROR: {message}', file=sys.stderr)
        return 1

    print(
        f'RHW validation passed: {len(parser.css)} static stylesheets, {len(parser.js)} static scripts, '
        f'{len(V4_RUNTIME_ASSETS)} V4 runtime assets, {len(parser.ids)} unique static ids; app version {version}.'
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
