# Resolution Heavy Works Web App - V4.0 Preview

This repository powers the live RHW dashboard and the in-development V4.0 Web App. The public Pages site remains on the released V3.6 layout until V4.0 is explicitly reviewed and merged.

## Stable dashboard layer

- `index.html` - stable page structure and authoritative V3.x stylesheet/script order
- `css/01-core.css` through `css/11-layout-v36.css` - released dashboard visual system and responsive layout
- `js/config.js` - recipes, thresholds, tracked commodities, facilities, hull aliases and base constants
- `js/00-bootstrap.js` - early utility plus the isolated V4 preview bootstrap
- `js/01-wire.js` through `js/11-layout-v36.js` - released dashboard logic and V3.6 presentation controls
- `assets/RHW_Newswire.md` - editable dashboard ticker source

The stable V3.x load order remains unchanged. V4 starts only after the stable dashboard has initialized, so COMMAND still has the released dashboard as a fallback if a V4 asset fails.

## V4.0 architecture

V4 uses one shared `window.RHWV4` application object. Feature modules register their own responsibilities instead of replacing functions from earlier files.

- `js/12-app-config.js` - app identity, workspace settings, COMMS presets, built-in senders and calculator defaults
- `js/13-app-v40.js` - shared app core, three-workspace shell, utilities and route model
- `js/14-app-v40-cache.js` - browser-local state, sender identities, draft snapshots, migration and cache import/export
- `js/15-app-v40-navigation.js` - COMMAND nodes, executive overview, priority actions and Inventory subviews
- `js/16-app-v40-composer.js` - COMMS nodes, Forum Composer, BBCode, Ticker Builder, drafts and sender editor
- `js/17-app-v40-operations-core.js` - recipe-catalog loader and recursive fabrication-planning engine
- `js/18-app-v40-operations-ui.js` - OPERATIONS workspace and Item Calculator UI
- `js/19-app-v40-runtime.js` - deterministic runtime boot, self-test and browser-smoke diagnostics
- `css/12-app-v40.css` through `css/16-app-v40-operations.css` - V4 shell, navigation, composer, preview polish and calculator UI

## COMMAND

V4 COMMAND is split into bookmarkable nodes:

- `#command/overview` - Executive Status Board with live health cards and **Priority Actions**
- `#command/inventory` - Inventory workspace with `STATUS BOARD` and `FULL MANIFEST` views
- `#command/shipyard` - Capital Shipyard Control
- `#command/production` - compact Production Modules with expandable recipe detail
- `#command/logistics` - fixed remote facilities and Regional Market Scan

The V4 Shipyard hierarchy is **Hull Registry first, Component Reserve second**. Registered Bretonian hulls receive a `PLAN 1 HULL` action that opens the Item Calculator with the matching target selected.

## OPERATIONS

`#operations/calculator` opens the RHW Item Calculator / Fabrication Planner.

The normalized recipe catalog is generated from Discovery Freelancer's public game configuration at `https://discoverygc.com/gameconfigpublic/`:

- source inputs: `base_recipe_items.cfg` and `base_recipe_modules.cfg`
- builder: `scripts/build_recipe_catalog.py`
- browser assets: six deterministic compressed chunks at `assets/recipes/catalog-v1-part-01.js` through `catalog-v1-part-06.js`

The current catalog contains **289 recipes, 247 build targets and 65 affiliation/IFF profiles**, including item and base-module recipes, alternative inputs, retained catalysts/personnel, multiple outputs/byproducts and restrictions.

The calculator supports searchable item/module/capital-hull targets, quantity and recipe-variant selection, BMM-default affiliation/IFF processing, optional verified RHW inventory deduction, recursive intermediate crafting, alternative-input routing, direct requirements, a production tree, raw/external totals, outputs/byproducts/catalysts, procurement-list copying and a one-click prefilled COMMS procurement transmission.

Catalysts/personnel are treated as retained availability rather than consumed once per production cycle; the UI states this policy explicitly.

To rebuild the catalog after obtaining newer public config files:

```bash
python3 scripts/build_recipe_catalog.py \
  /path/to/base_recipe_items.cfg \
  /path/to/base_recipe_modules.cfg \
  --output-dir assets/recipes
```

## COMMS

COMMS is split into:

- `#comms/forum` - Forum Transmission Composer
- `#comms/ticker` - BMM Industrial Newswire builder with live ticker preview
- `#comms/drafts` - browser-local named drafts and cache portability
- `#comms/senders` - built-in and browser-local sender identity registry with local-profile editing

## Validation and runtime smoke testing

`scripts/validate_dashboard.py` checks the stable static load order, file references, duplicate static IDs, V4 calculator/runtime assets and required module hooks.

`scripts/smoke_v40.py` launches headless Chrome/Chromium through the Chrome DevTools Protocol and verifies all ten current V4 routes: five COMMAND nodes, `OPERATIONS / ITEM CALCULATOR` with the 289-recipe catalog, and four COMMS nodes.

GitHub Actions runs structure validation, JavaScript syntax checks and the browser runtime smoke test before deployment. Pull requests validate only; deployment is skipped for PRs.

GitHub Pages deployment remains handled by `.github/workflows/rhw-pages-deploy.yml`.

**V4.0 is not released while this work remains on `agent/rhw-v40-webapp` / Draft PR #3.** Production `main` and the public Pages site remain on V3.6 until an explicit merge is requested.
