# Resolution Heavy Works Web App - V4.0 Preview

This repository powers the RHW command dashboard and the in-development RHW Web App workspaces.

## Structure

- `index.html` - stable page structure and the authoritative V3.x stylesheet/script load order
- `css/01-core.css` through `css/09-v35.css` - visual system and responsive layouts
- `css/10-maintenance.css` - maintenance overrides, mobile newswire support and graceful visual fallbacks
- `css/11-layout-v36.css` - V3.6 visual hierarchy, responsive layout, mobile manifest and production density layer
- `css/12-app-v40.css` - V4.0 application navigation and COMMS workspace styling
- `js/config.js` - recipes, thresholds, tracked commodities, facilities, hull aliases and base-level constants
- `js/00-bootstrap.js` - early-load utility plus safe V4 dynamic bootstrap after the stable dashboard has initialized
- `js/01-wire.js` through `js/09-newswire.js` - dashboard logic in load order
- `js/10-maintenance.js` - behavior-preserving hardening for shared calculations and late feature compatibility
- `js/11-layout-v36.js` - V3.6 presentation controls, production detail toggle and command-flow ordering
- `js/12-app-config.js` - V4.0 app settings, forum presets and built-in sender identities
- `js/13-app-v40.js` - V4.0 application shell and COMMS Forum Transmission Composer
- `assets/RHW_Newswire.md` - editable editorial ticker messages
- `scripts/validate_dashboard.py` - dependency-free structural validation for local use and CI

The stable dashboard load order in `index.html` is part of the dashboard contract. V4 is layered on after `DOMContentLoaded` so the V3.6 COMMAND dashboard remains the fallback if an app-layer asset fails.

## V4.0 workspaces

The V4 application shell keeps the RHW header and industrial newswire global, then introduces switchable workspaces below them:

1. **COMMAND** - the existing live logistics, shipyard, production, market and manifest dashboard
2. **COMMS** - Forum Transmission Composer with sender profiles, template presets, live RHW preview, generated forum BB code and browser-local draft storage

The first built-in COMMS sender is **Alistair Thorne**. Temporary characters can be entered through `CUSTOM / TEMPORARY SENDER` and saved as browser-local sender profiles without changing repository code. Additional permanent RHW characters belong in `js/12-app-config.js`.

Named COMMS drafts and locally saved sender profiles use browser `localStorage`; they are not uploaded to GitHub and remain specific to that browser/profile.

## Layout flow

The V3.6 COMMAND presentation layer keeps the underlying dashboard data model unchanged while presenting the command surface in this operational order:

1. facility / export / feedstock overview
2. capital shipyard control
3. production modules
4. external logistics and regional market scan
5. logistics manifest

Production modules open in a compact command-summary state; full ingredient tables remain available through the recipe-details control. The manifest retains its dense table on larger screens and becomes a readable asset-card layout on mobile displays.

## Current capital hull API codes

- Dunkirk-Class Battleship: `dsy_br_battleship`
- Invincible-Class Dreadnought: `dsy_br_carrier`

Stock, `min_stock` and `max_stock` are read from the live telemetry API. The thin blue line in stock bars marks the live in-game minimum reserve boundary. The configured raw maximum for RHW structural health is stored as `baseHealthMax` in `js/config.js`.

## Editing

Most dashboard data/configuration changes should be made in `js/config.js`. Newswire text can be changed independently in `assets/RHW_Newswire.md`. V4 app identities and COMMS presets live in `js/12-app-config.js`.

Before deployment, CI checks JavaScript syntax plus the dashboard's local file references, stylesheet/script order, V4 bootstrap assets and duplicate static HTML IDs. The same structural check can be run with:

```bash
python3 scripts/validate_dashboard.py
```

GitHub Pages deployment is handled by `.github/workflows/rhw-pages-deploy.yml`. Pull requests run validation only; pushes to `main` validate first and deploy only after the checks pass.

The live site remains on the current released version until the V4 branch is reviewed and merged. The active development line is **V4.0 PREVIEW**.
<!-- RHW deploy trigger -->
