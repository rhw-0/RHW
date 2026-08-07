#!/usr/bin/env python3
"""Dependency-free structural checks for the static RHW dashboard and web app."""

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
    "./js/12-app-config.js",
    "./js/13-app-v40.js",
    "./js/14-app-v40-cache.js",
    "./js/15-app-v40-navigation.js",
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

    layout_js = (ROOT / "js/11-layout-v36.js").read_text(encoding="utf-8")
    if "arrangeV36CommandFlow" not in layout_js or "initProductionDetailsToggle" not in layout_js:
        fail(errors, "V3.6 layout controls are incomplete.")

    bootstrap = (ROOT / "js/00-bootstrap.js").read_text(encoding="utf-8")
    for required in (
        "./css/12-app-v40.css",
        "./js/12-app-config.js",
        "./js/13-app-v40.js",
        "./js/14-app-v40-cache.js",
        "./js/15-app-v40-navigation.js",
    ):
        if required not in bootstrap:
            fail(errors, f"V4 bootstrap does not reference required asset: {required}")

    app_config = (ROOT / "js/12-app-config.js").read_text(encoding="utf-8")
    if "RHW_APP_VERSION = 'V4.0 PREVIEW'" not in app_config or "alistair-thorne" not in app_config:
        fail(errors, "V4 app configuration is missing the preview version or built-in Alistair sender profile.")
    for required_config in ("classification:", "accent:", "ML-KEM-1024"):
        if required_config not in app_config:
            fail(errors, f"V4 transmission configuration is incomplete: {required_config}")

    app_js = (ROOT / "js/13-app-v40.js").read_text(encoding="utf-8")
    for required_hook in ("appInstallShell", "appBuildForumBbcode", "appSaveLocalSender", "appSaveNamedDraft"):
        if required_hook not in app_js:
            fail(errors, f"V4 COMMS controls are incomplete: {required_hook}")

    cache_js = (ROOT / "js/14-app-v40-cache.js").read_text(encoding="utf-8")
    for required_hook in ("appExportLocalCache", "appImportLocalCacheFile"):
        if required_hook not in cache_js:
            fail(errors, f"V4 local-cache portability is incomplete: {required_hook}")

    nav_js = (ROOT / "js/15-app-v40-navigation.js").read_text(encoding="utf-8")
    for required_hook in (
        "v40GenerateCipher",
        "v40InstallCommandNodes",
        "v40InstallCommsNodes",
        "v40BodyToBbcode",
        "v40RenderSenderRegistry",
    ):
        if required_hook not in nav_js:
            fail(errors, f"V4 node/navigation controls are incomplete: {required_hook}")

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
        f"{len(parser.ids)} unique ids."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
