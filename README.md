# Resolution Heavy Works Web App - V4.0.2

V4.0.2 is the current RHW web app release.

The app is split into three workspaces:

- **COMMAND** — Overview, Inventory, Shipyard, Production and Logistics.
- **OPERATIONS** — recipe-first manufacturing calculator backed by Discovery's public game configuration.
- **COMMS** — forum transmission composer, Newswire file manager, drafts and sender identities.

`OPERATIONS / ITEM CALCULATOR` contains the corrected runtime catalog of **287 recipes / 248 build targets**. It supports recipe search, distinct recipe-variant labels, output quantity, BMM-default IFF handling, affiliation-dependent outputs, manual material prices for the current calculation, fixed recipe fees where defined, batch build cost, cost per unit, target profit margin, recommended sale price, revenue and profit. Optional **PRICE PROFILES** can be saved explicitly in the browser and loaded on demand; they are never applied automatically.

`COMMAND / SHIPYARD` includes a compact multi-hull build planner. Choose a registered hull and target quantity to compare required capital components with verified RHW stock, see deficits, and send the same quantity directly to the Item Calculator.

`COMMS / NEWSWIRE MANAGER` loads `assets/RHW_Newswire.md` into a local working copy. **Newswire 2.0** adds full-text search, category and readiness filters, duplicate/content warnings, priority pinning and a guarded output step. Every bulletin drives synchronized Dashboard Ticker and Forum BBCode previews from the same editor content. Entries can be added, edited, deleted and reordered within their category, then copied or exported as an updated Markdown file. Local recovery protects unfinished work; the public static site does not publish Newswire edits back to GitHub automatically.

## Install on Samsung, Android or iPhone / iPad

RHW is an installable Progressive Web App. Open the GitHub Pages site in Samsung Internet, tap the menu (☰), then choose **Add page to → Home screen**. In Chrome for Android, open the menu (⋮) and choose **Install app** or **Add to Home screen**. On iPhone or iPad, open RHW in Safari, tap **Share**, then choose **Add to Home Screen**. A successful installation launches RHW in a dedicated app window without normal browser tabs or the address bar; the operating-system status bar can remain visible.

The app shell, local Newswire source and catalog assets are cached for offline access. RHW always labels offline mode clearly and never presents failed live telemetry as current data. Service-worker updates wait for an explicit **Update now** action so local drafts and settings remain under user control.

Validation runs through `.github/workflows/rhw-pages-deploy.yml` and includes structural checks, JavaScript syntax validation, full headless-Chrome route/interactions, PWA install/offline behavior, Newswire 2.0 search/quality/channel-parity behavior and recipe-correctness coverage.
