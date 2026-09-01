# Resolution Heavy Works Web App - V4.0.2

V4.0.2 is the current RHW web app release.

**Canonical repository:** `PhyteHQ/RHW`  
**Canonical web app:** `https://phytehq.github.io/RHW/`

The app is split into three visible workspaces:

- **COMMAND** — Inventory, Shipyard, Production and Logistics.
- **CALCULATOR** — recipe-first manufacturing calculator plus Production Orders, backed by Discovery's public game configuration.
- **COMMS** — forum transmission composer, Newswire file manager, drafts and sender identities.

`CALCULATOR / ITEM CALCULATOR` contains the validated current catalog of **285 recipes / 246 build targets**. It supports recipe search, distinct recipe-variant labels, output quantity, BMM-default IFF handling, affiliation-dependent outputs, manual material prices for the current calculation, fixed recipe fees where defined, batch build cost, cost per unit, target profit margin, recommended sale price, revenue and profit. Optional **PRICE PROFILES** can be saved explicitly in the browser and loaded on demand; they are never applied automatically.

`CALCULATOR / PRODUCTION ORDERS` turns calculator targets into a local priority queue. Every order keeps its recipe, quantity and IFF selection, while the board aggregates all direct material requirements with the Calculator's exact batch rounding. Verified stock reveals shared bottlenecks; without verified telemetry the board stays explicitly in an awaiting state. The visual Forum report and copyable BBCode are generated from the same order snapshot. Orders are included in local backup exports, but material prices remain session-only.

The **DISCOVERY DATA** panel shows the active counts, source hashes, last catalog update and latest automation run. `.github/workflows/discovery-catalog-sync.yml` checks Discovery's public recipe CFG files every Monday and can also be started manually from GitHub Actions. Downloads are staged temporarily and must pass structural, ID/output/quantity/IFF and large-change gates. Real changes rebuild the deterministic browser catalog and prepare or refresh a **Draft pull request** with `docs/discovery-sync-report.md`; the workflow never merges its own proposal.

`COMMAND / SHIPYARD` includes a compact multi-hull build planner. Choose a registered hull and target quantity to compare required capital components with verified RHW stock, see deficits, and send the same quantity directly to the Item Calculator.

`COMMS / NEWSWIRE MANAGER` loads `assets/RHW_Newswire.md` into a local working copy. **Newswire 2.0** adds full-text search, category and readiness filters, duplicate/content warnings, priority pinning and a guarded output step. Every bulletin drives synchronized Dashboard Ticker and Forum BBCode previews from the same editor content. Entries can be added, edited, deleted and reordered within their category, then copied or exported as an updated Markdown file. Local recovery protects unfinished work; the public static site does not publish Newswire edits back to GitHub automatically.

The **NEWSWIRE REVIEW DESK** compares the current repository source with the local working copy and reports added, edited, deleted and reordered bulletins. It keeps up to eight browser-local restoration points and blocks handoff when the repository source is unavailable, a recovered draft belongs to an older source, or Newswire QA still finds warnings. Once the gate passes, mobile devices can share one review package through the native share menu; desktop browsers can download it. The package contains canonical Markdown, the reviewed base, the change report, QA result and matching Forum BBCode. It contains no GitHub credentials and cannot publish by itself: open it in ChatGPT Work to review and prepare a GitHub **Draft pull request**.

`COMMS / DRAFTS` contains the private **DEVICE TRANSFER** center. On supported phones, **SHARE PRIVATE BACKUP** opens the native Android or iOS share sheet with one JSON file; otherwise RHW downloads the same file. Import never uploads anything and always opens a review sheet first. Drafts, senders, price profiles and production orders use conflict-safe merge mode, while the current message, Shipyard plan, Newswire working copy and app settings are explicit opt-in replacements. Backup files can contain private work and should only be shared with a trusted device.

## Install on Samsung, Android or iPhone / iPad

Open **`https://phytehq.github.io/RHW/`** in the browser you want to use for installation.

RHW is an installable Progressive Web App. In Samsung Internet, tap the menu (☰), then choose **Add page to → Home screen**. In Chrome for Android, open the menu (⋮) and choose **Install app** or **Add to Home screen**. On iPhone or iPad, open RHW in Safari, tap **Share**, then choose **Add to Home Screen**. A successful installation launches RHW in a dedicated app window without normal browser tabs or the address bar; the operating-system status bar can remain visible.

The app shell, local Newswire source and catalog assets are cached for offline access. RHW always labels offline mode clearly and never presents failed live telemetry as current data. New service-worker versions are checked automatically and can activate/reload the app automatically, so an **Update now** prompt is not guaranteed to appear for every release.

### Migration from the old `rhw-0` GitHub username

The repository was renamed from `rhw-0/RHW` to `PhyteHQ/RHW`. GitHub may redirect old repository links, but the installed PWA and browser-local data are origin-bound. Before removing an RHW installation created from `rhw-0.github.io`, open **COMMS → DRAFTS → SHARE PRIVATE BACKUP** and save the JSON backup. Then install RHW from `https://phytehq.github.io/RHW/` and import that backup through the Device Transfer review flow. This preserves drafts, senders, price profiles, production orders and other opted-in local state across the domain change.

The app header also contains **SYS CHECK**, a mobile-friendly reliability center for runtime, local-save, connection, telemetry, offline-app, recipe-catalog, Discovery and Newswire health. PR11 adds a repeatable **FULL APP AUDIT** there for the complete route shell, UI state, accessibility links, modal keyboard safety, viewport fit, mobile touch targets, reduced-motion behavior, local storage, PWA support, catalog truth and synthetic Forum/Newswire/Production output parity. Both copyable reports are deliberately content-free: they never include drafts, messages, sender profiles, material prices or inventory values. Damaged RHW JSON cache entries are backed up under a recovery key before the affected entry is reset. The complete check matrix is documented in `docs/full-app-audit.md`.

Validation runs through `.github/workflows/rhw-pages-deploy.yml` and includes structural checks, JavaScript syntax validation, Discovery sync, Transfer Center, Newswire Review and Full App Audit model coverage, full headless-Chrome route/interactions, PWA install/offline behavior, reliability diagnostics, corrupted-cache recovery, Clipboard truth-state, Production Order queue/material/Forum parity, Newswire search/quality/channel-parity, live/local diff, restoration and controlled-handoff behavior, plus recipe-correctness coverage.
