# Calculator + Logistics Market Scan UI Fix

This change follows live mobile feedback after the unified RHW UI rollout.

## Workspace label

The user-facing `operations` workspace is labeled **CALCULATOR**. Internal route/storage keys remain `operations` so existing links and local state remain compatible.

Visible hierarchy:

- COMMAND
- CALCULATOR
  - ITEM CALCULATOR
  - PRODUCTION ORDERS
- COMMS

## Logistics market scan

The existing Regional Market Scan engine and its live DOM are retained. The scan is no longer nested inside the legacy `externalLogisticsPanel` that also owns the two fixed procurement links.

At runtime `marketScanSection` is moved to a direct child of the active LOGISTICS panel, immediately before the fixed-logistics panel. Because the original `marketScanGrid`, meta element, and sort controls are moved rather than copied, the stable `renderMarketScan` / `renderSupplier` data flow keeps updating the exact same elements.

Visible LOGISTICS hierarchy:

1. **EXTERNAL MARKET SCAN** — all configured goods across all known POBs/bases, with existing Best Price / Most Stock sorting.
2. **FIXED LOGISTICS LINKS** — the dedicated Lisheen / Shelton procurement links.

The market scan surface has explicit desktop and phone styling and is no longer dependent on legacy remote-panel nesting.

## Compatibility

No changes to telemetry fetching, market calculation rules, prices, recipes, Production Orders, COMMS, route URLs, or stored user data.
