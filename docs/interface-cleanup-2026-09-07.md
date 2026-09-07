# RHW interface cleanup

The daily workspaces had accumulated repeated headings, permanently visible optional settings and separate entry points for related system information. This pass implements the requested UI changes from points 1–4 and 6. Point 5 is excluded: no recent-recipe list, completion state, archive or production-order tracking is added. Existing saved orders are not migrated or deleted, and no new order shortcut is introduced.

- Compact header with the crest, base metrics and connection status. Clock, sync timings, datalink and effects settings remain accessible inside Connection Details; refresh remains directly accessible.
- Calculator price profiles use a collapsed native disclosure. Complete Missing Prices focuses the next blank material price; zero is a valid entered price. The action disappears when the quote is complete.
- The calculator owns its price-storage explanation. An older UI observer no longer overwrites it with a contradictory claim that prices cannot be saved.
- Forum writing fields appear before transmission metadata. Existing metadata values, defaults, local persistence and BBCode generation are preserved. More exposes the additional formatting buttons, and Drafts/Senders are available from the editor.
- Discovery catalog provenance, source hashes and sync controls share the System + Data dialog. The existing data shortcut API opens this dialog for compatibility. The Tools menu has five entries.
- Repeated workspace captions, catalog counts and internal release labels are removed from the UI.
- The real render entry point updates base telemetry even before the first successful fetch, so a failed initial uplink replaces all three loading placeholders.

Verification covers model/structure checks and the existing GitHub browser suite. The Focus Pass test now exercises disclosures, missing-price focus with zero-price handling, forum metadata/formatting, contextual navigation, and header geometry at 360, 390, 412, 430 and 1366 pixels.
