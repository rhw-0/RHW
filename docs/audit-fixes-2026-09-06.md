# RHW audit fixes — 6 September 2026

Build: `2026-09-06-audit-fixes-1` (V4.0.2).

The audit found incorrect sale quotes, a destructive import edge case and misleading data states. This change fixes the underlying calculations and state handling, then applies them to the daily Command, Calculator and Forum flows.

| Audit item | Result |
|---|---|
| A1: mobile quote omits fees | Desktop, mobile and input updates use `operationsCore.priceQuote`, including fixed fees. |
| A2: `1.000` parsed as one output | Costing takes numeric `plan.actualOutput`; formatted text is display-only. Zero margin is preserved. |
| A3: import drops an existing order at 100 | Merge is preflighted before any selected backup section changes. Overflow is rejected with counts; newer versions of existing IDs still fit. Failed order storage preserves the active queue. |
| A4: Discovery workflow targets former owner | Workflow guard, generated provenance and automation references target `PhyteHQ/RHW`. Draft PR and no-auto-merge policy remain active. |
| A5: old inventory exported as current | Reports and previews carry the original snapshot time, age and LIVE/CACHED/UNAVAILABLE state. Shipyard and Command use the same freshness model. |
| A6: failed sync appears healthy | System checks use the actual workflow conclusion. Unavailable checks, skipped runs and overdue successes are warnings; failures are errors. Review policy is a separate requirement. |
| A7: cached Newswire trusted for review | SW marks cached responses and preserves original fetch time. The editor labels them CACHED and blocks review handoff. Forced offline reload preserves the working draft. |
| A8: first failed sync leaves loading text | Header, logistics and dynamic news slots display unavailable states after failure. |
| A9: stale repository references | Review packages and Discovery links use shared repository metadata. Model and browser test expectations target the current repository. |

Additional changes:

- Updates wait for the user to restart; initial activation and activation in another tab do not reload active work. Current material prices trigger an explicit restart warning. Prices remain session-only unless a profile is deliberately saved/loaded.
- Mobile status text is larger and has higher contrast; important controls have a 44px target, visible focus and explicit quantity/price labels.
- Archon and Modular Miner searches find both Medium Miner variants. Their IFF restrictions remain separate. The upstream [recipe CFG](https://github.com/SlimyTheMoon/DiscoveryRecipieCalculator/blob/main/Sources/base_recipe_items.cfg) identifies `medium_miner_package` as Modular Miner and `blueprint_medium_miner` as Archon Design Schematics; no material quantities were changed.
- The Shipyard planner mounts before the first successful telemetry response. Targets and requirements work offline; stock coverage stays unknown. The stock/registry block remains above the planner when data becomes available.
- Material IDs are available in expandable details. Command emphasizes stock age and refresh needs; the calculator shows full cost per output and batch totals.
- The DOM-based fee observer and duplicate quote calculation were removed. Shared build metadata drives asset revision, SW cache revision and System details.

## Validation

`scripts/test_audit_regressions.js` executes the shipped embedded catalog and application modules. It covers 280 buildable recipes, the 1,000-output fee regression, 0/20/95% margins, partial quotes, desktop/mobile rendering and input-update parity, Archon lookup, cold/offline/stale telemetry, offline Shipyard mounting and recovery, sync health, SW cache provenance through the actual Newswire loader, draft preservation and update lifecycle.

Existing Production Order, Transfer Center and Newswire Review tests add capacity, storage-failure and cached-source cases. Structural validation and the full existing GitHub browser smoke suite remain required gates. The five catalog recipes without a usable authorized IFF remain restricted; the audit does not invent authorizations or alter game recipes.

Deploying or running the corrected scheduled sync is separate from validating this PR. Existing installed sessions receive the new update behavior after loading this build.
