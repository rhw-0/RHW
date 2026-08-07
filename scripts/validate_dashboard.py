#!/usr/bin/env python3
"""Dependency-free structural checks for the static RHW dashboard and V4 web app."""

from __future__ import annotations

from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"

EXPECTED_CSS = [
    "./css/01-core.css",
    "./css/02-ticker.css",
    "./css/03-production.css",
    "./css/04-responsive.css",
    "./css/05-shipyard.css",
    "./css/06-shipyard-detail.css",
    "./css/07-mobile.css",
    "./css/08-headings.css",
    "./css/09-v35.css",
    "./css/10-maintenance.css",
    "./css/11-layout-v36.css",
]

EXPECTED_JS = [
    "./js/config.js",
    "./js/00-bootstrap.js",
    "./js/01-wire.js",
    "./js/02-utils.js",
    "./js/03-telemetry.js",
    "./js/04-state-production.js",
    "./js/05-shipyard.js",
    "./js/06-logistics.js",
    "./js/07-overview.js",
    "./js/08-data.js",
    "./js/09-newswire.js",
    "./js/10-maintenance.js",
    "./js/11-layout-v36.js",
]

V4_DYNAMIC_ASSETS = [
    "./css/12-app-v40.css",
    "./css/13-app-v40-navigation.css",
    "./css/14-app-v40-composer.css",
    "./css/15-app-v40-audit.css",
    "./js/12-app-config.js",
    "./js/13-app-v40.js",
    "./js/14-app-v40-cache.js",
    "./js/15-app-v40-navigation.js",
    "./js/16-app-v40-composer.js",
    "./js/17-app-v40-audit.js",
    "./scripts/smoke_v40.py",
]


class DashboardParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.css: list[str] = []
        self.js: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if values.get("id"):
            self.ids.append(values["id"] or "")
        if tag == "link" and values.get("rel") == "stylesheet" and values.get("href", "").startswith("./css/"):
            self.css.append(values["href"] or "")
        if tag == "script" and values.get("src", "").startswith("./js/"):
            self.js.append(values["src"] or "")


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def require_tokens(errors: list[str], path: str, tokens: tuple[str, ...], label: str) -> None:
    text = (ROOT / path).read_text(encoding="utf-8")
    for token in tokens:
        if token not in text:
            fail(errors, f"{label} is incomplete: {token}")


def main() -> int:
    errors: list[str] = []
    if not INDEX.exists():
        print("ERROR: index.html is missing", file=sys.stderr)
        return 1

    parser = DashboardParser()
    parser.feed(INDEX.read_text(encoding="utf-8"))

    if parser.css != EXPECTED_CSS:
        fail(errors, "Stylesheet load order differs from the documented RHW order.")
    if parser.js != EXPECTED_JS:
        fail(errors, "JavaScript load order differs from the documented RHW order.")

    for ref in [*parser.css, *parser.js, *V4_DYNAMIC_ASSETS, "./assets/RHW_Newswire.md"]:
        local_path = ROOT / ref.removeprefix("./")
        if not local_path.is_file():
            fail(errors, f"Referenced local file is missing: {ref}")

    duplicate_ids = sorted(key for key, count in Counter(parser.ids).items() if count > 1)
    if duplicate_ids:
        fail(errors, "Duplicate HTML id values: " + ", ".join(duplicate_ids))

    config = (ROOT / "js/config.js").read_text(encoding="utf-8")
    if "baseHealthMax:" not in config:
        fail(errors, "js/config.js must define baseHealthMax.")

    require_tokens(errors, "js/11-layout-v36.js", ("arrangeV36CommandFlow", "initProductionDetailsToggle"), "V3.6 layout controls")

    bootstrap = (ROOT / "js/00-bootstrap.js").read_text(encoding="utf-8")
    for required in V4_DYNAMIC_ASSETS[:-1]:
        if required not in bootstrap:
            fail(errors, f"V4 bootstrap does not reference required asset: {required}")

    require_tokens(errors, "js/12-app-config.js", (
        "RHW_APP_VERSION = 'V4.0 PREVIEW'", "alistair-thorne", "salutations:", "closings:", "ADMIRALTY PROCUREMENT FILE"
    ), "V4 configuration")
    require_tokens(errors, "js/13-app-v40.js", (
        "window.RHWV4", "app.installShell", "app.navigate", "app.applyRoute"
    ), "V4 core")
    require_tokens(errors, "js/14-app-v40-cache.js", (
        "app.storage", "saveDraft", "upsertSender", "importPayload", "senderSnapshotName"
    ), "V4 storage")
    require_tokens(errors, "js/15-app-v40-navigation.js", (
        "PRIORITY ACTIONS", "inventory-view-nav", "priorityActions", "activateInventoryView"
    ), "V4 COMMAND module")
    require_tokens(errors, "js/16-app-v40-composer.js", (
        "SALUTATION / OPENING", "comms-editor-toolbar", "ticker-builder-preview", "data-edit-sender", "buildBbcode"
    ), "V4 COMMS module")
    require_tokens(errors, "js/17-app-v40-audit.js", (
        "dataset.v40Ready", "selfTest", "__RHW_V4_SMOKE__", "app.runtime"
    ), "V4 runtime")

    # Consolidated V4 modules must not use the old patch-chain pattern.
    for path in ("js/13-app-v40.js", "js/14-app-v40-cache.js", "js/15-app-v40-navigation.js", "js/16-app-v40-composer.js", "js/17-app-v40-audit.js"):
        text = (ROOT / path).read_text(encoding="utf-8")
        if "BaseApply" in text or "BaseActivate" in text or "const v40Base" in text:
            fail(errors, f"V4 module still contains legacy override-chain hooks: {path}")

    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    if ".github/workflows/rhw-pages-deploy.yml" not in readme:
        fail(errors, "README deployment documentation does not name the active workflow.")

    if errors:
        for message in errors:
            print(f"ERROR: {message}", file=sys.stderr)
        return 1

    print(
        f"RHW validation passed: {len(parser.css)} static stylesheets, "
        f"{len(parser.js)} static scripts, {len(V4_DYNAMIC_ASSETS)} V4 dynamic assets, "
        f"{len(parser.ids)} unique static ids."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
