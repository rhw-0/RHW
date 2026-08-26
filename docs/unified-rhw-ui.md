# RHW Unified UI

RHW keeps three distinct workspaces but now uses one shared interaction language across them.

## Workspace identity

- **COMMAND** uses the RHW gold accent and live operational telemetry.
- **OPERATIONS** uses green and exposes costing / production-order state.
- **COMMS** uses blue and exposes composer / Newswire / archive / identity state.

The global workspace switcher and each workspace's module navigation now use the same hierarchy: numbered identity, large title, concise purpose text, active treatment and an honest current-state badge.

## COMMAND power tools

### Command Finder

One search field searches existing COMMAND content across Inventory, Shipyard, Production and Logistics. Results open the correct area and highlight the matching row/card. `/` focuses the finder when COMMAND is active.

### Needs Attention

`ALL AREAS` keeps the normal four-module view. `NEEDS ATTENTION` temporarily narrows the COMMAND module selector to areas currently reporting low or critical state. If nothing requires attention, RHW keeps all areas reachable and explicitly says that no monitored attention items are active.

### Deep-linked alerts

COMMAND Alerts no longer only open a section. RHW derives the meaningful target from the alert text, opens the relevant area and highlights the closest matching asset / component / recipe / route.

### Cross-workspace decisions inside COMMAND

- Shipyard can surface a **FIND SUPPLY** action for its current next-hull bottleneck and jump into Logistics.
- Production can surface a **CHECK STOCK** action for its current bottleneck and jump into Inventory.
- Logistics can jump directly into **Inventory / Full Manifest**.

### Mobile return

On phones a compact `COMMAND ↑` control appears after the operator has moved deep into COMMAND content. It returns directly to the four operational modules without adding another persistent navigation bar.

## Honest module state

The shared UI does not fake identical health semantics:

- COMMAND shows existing telemetry-derived states and attention counts.
- Item Calculator shows the loaded recipe count.
- Production Orders shows order count and high/urgent priority state.
- Forum reports composer/autosave readiness.
- Newswire reports loaded bulletins and local edits.
- Drafts reports saved local drafts.
- Senders reports available identities.

## PWA catalog freshness

The unified UI service-worker revision also changes Discovery status and recipe catalog chunks to network-first with cache fallback. App-shell code remains cache-first. This preserves offline use while allowing data-only Discovery updates to reach already-installed RHW apps without requiring an unrelated service-worker code release.

## Scope guardrails

This UI layer does not change recipe math, telemetry thresholds, Shipyard build calculations, Production Order data, forum BBCode generation, Newswire review rules or the 11-route application topology.
