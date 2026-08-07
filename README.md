# Resolution Heavy Works Command Dashboard - V3.5

This repository powers the public RHW logistics, production, market and capital shipyard dashboard.

## Structure

- `index.html` - page structure and the authoritative stylesheet/script load order
- `css/01-core.css` through `css/09-v35.css` - visual system and responsive layouts
- `css/10-maintenance.css` - maintenance overrides, mobile newswire support and graceful visual fallbacks
- `js/config.js` - recipes, thresholds, tracked commodities, facilities, hull aliases and base-level constants
- `js/00-bootstrap.js` - tiny early-load fallback required before the main dashboard scripts
- `js/01-wire.js` through `js/09-newswire.js` - dashboard logic in load order
- `js/10-maintenance.js` - behavior-preserving hardening for shared calculations and late feature compatibility
- `assets/RHW_Newswire.md` - editable editorial ticker messages
- `scripts/validate_dashboard.py` - dependency-free structural validation for local use and CI

The load order in `index.html` is part of the dashboard contract. Do not reorder the CSS or JavaScript files casually; later layers intentionally depend on earlier globals.

## Current capital hull API codes

- Dunkirk-Class Battleship: `dsy_br_battleship`
- Invincible-Class Dreadnought: `dsy_br_carrier`

Stock, `min_stock` and `max_stock` are read from the live telemetry API. The thin blue line in stock bars marks the live in-game minimum reserve boundary. The configured raw maximum for RHW structural health is stored as `baseHealthMax` in `js/config.js`.

## Editing

Most future data/configuration changes should be made in `js/config.js`. Newswire text can be changed independently in `assets/RHW_Newswire.md`.

Before deployment, CI checks JavaScript syntax plus the dashboard's local file references, stylesheet/script order and duplicate HTML IDs. The same structural check can be run with:

```bash
python3 scripts/validate_dashboard.py
```

GitHub Pages deployment is handled by `.github/workflows/rhw-pages-deploy.yml`. Pull requests run validation only; pushes to `main` validate first and deploy only after the checks pass.

The public dashboard version remains **V3.5**.
<!-- RHW deploy trigger -->
