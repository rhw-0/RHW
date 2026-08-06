# Resolution Heavy Works Command Dashboard - V3.5

This repository powers the public RHW logistics, production, market and capital shipyard dashboard.

## Structure

- `index.html` - page structure
- `css/` - visual system and responsive layouts
- `js/config.js` - recipes, thresholds, tracked commodities, facilities and hull aliases
- `js/01-wire.js` through `js/09-newswire.js` - dashboard logic in load order
- `assets/RHW_Newswire.md` - editable editorial ticker messages

## Current capital hull API codes

- Dunkirk-Class Battleship: `dsy_br_battleship`
- Invincible-Class Dreadnought: `dsy_br_carrier`

Stock, `min_stock` and `max_stock` are read from the live telemetry API. The thin blue line in stock bars marks the live in-game minimum reserve boundary.

## Editing

Keep the script and stylesheet order in `index.html`. Most future data/configuration changes should be made in `js/config.js`. Newswire text can be changed independently in `assets/RHW_Newswire.md`.

The public dashboard version remains **V3.5**.
