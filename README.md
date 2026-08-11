# Resolution Heavy Works Web App - V4.0

V4.0 is the current RHW web app release.

The app is split into three workspaces:

- **COMMAND** — Overview, Inventory, Shipyard, Production and Logistics.
- **OPERATIONS** — recipe-first manufacturing calculator backed by Discovery's public game configuration.
- **COMMS** — forum transmission composer, Newswire file manager, drafts and sender identities.

`OPERATIONS / ITEM CALCULATOR` contains the corrected runtime catalog of **287 recipes / 248 build targets**. It supports recipe search, distinct recipe-variant labels, output quantity, BMM-default IFF handling, affiliation-dependent outputs, manual material prices for the current calculation, fixed recipe fees where defined, batch build cost, cost per unit, target profit margin, recommended sale price, revenue and profit.

`COMMS / NEWSWIRE MANAGER` loads `assets/RHW_Newswire.md` into a local working copy. Entries can be added, edited, deleted, filtered and reordered within their category, then copied or exported as an updated Markdown file. The public static site does not publish Newswire edits back to GitHub automatically.

Validation runs through `.github/workflows/rhw-pages-deploy.yml` and includes structural checks, JavaScript syntax validation, full headless-Chrome route/interactions, Newswire manager behavior and recipe-correctness coverage.