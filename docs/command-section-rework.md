# COMMAND Section Rework

**Release status:** merged to `main` on 26 August 2026.

The COMMAND workspace is organized around four visible operational areas:

1. **Inventory** — status board and full manifest.
2. **Shipyard** — capital hulls, component reserve and build planner.
3. **Production** — production modules, capacity and bottlenecks.
4. **Logistics** — remote facilities, market scan and supply links.

## Why Overview is no longer a user-facing destination

The former Overview duplicated navigation: it summarized Inventory, Shipyard, Production and Logistics and then sent the operator to one of those same areas. The rework removes that extra hop. Normal COMMAND entry resolves directly to Inventory, while all four operational areas remain permanently visible in the COMMAND navigation.

The legacy Overview analysis remains mounted as a hidden internal status sensor. Existing, already-tested calculations for inventory health, hull readiness, production capacity and priority actions therefore continue to drive the new navigation and alert strip without creating a second telemetry model. It is not selectable in the normal COMMAND interface.

Old `#command/overview` links and stored Overview state are normalized to Inventory during normal runtime.

## Visibility rules

- Desktop: all four operational areas occupy equal-width modules in one row.
- Mobile: all four are visible at once in a 2×2 grid; COMMAND discovery never depends on horizontal scrolling.
- Each module displays only current-state information from the existing telemetry/status analysis. No tab-local "last change" history is introduced.
- The active module has a strong gold treatment, while critical/low/nominal/waiting state remains independently visible.

## COMMAND alerts

The useful Priority Actions portion of the former Overview is retained as a persistent, compact COMMAND alert strip. The first priority is always immediately visible; multiple items can be expanded and continue to deep-link to their relevant operational area.

## Inventory views

Inventory keeps two views — **Status Board** and **Full Manifest** — but they are promoted from subtle sub-tabs to large high-contrast mode controls. On phones they remain sticky below the COMMAND navigation.

## Scope

This rework intentionally does not change OPERATIONS, COMMS, telemetry calculation rules, Discovery catalog data, price profiles, Shipyard planning logic or Production Order behavior.
