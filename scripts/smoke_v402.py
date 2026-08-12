#!/usr/bin/env python3
"""Production-order headless-Chrome smoke test for RHW V4.0.2."""
from __future__ import annotations

import json, shutil, subprocess, time

import smoke_v40 as base

base.V4_CSS = [
    "css/12-app-v40.css", "css/13-app-v40-navigation.css", "css/14-app-v40-composer.css",
    "css/15-app-v40-audit.css", "css/16-app-v40-operations.css", "css/17-app-v40-calculator-polish.css",
    "css/18-app-v40-nav-hierarchy.css", "css/19-app-v402-fixes.css",
]
base.V4_JS = [
    "js/12-app-config.js", "js/13-app-v40.js", "js/14-app-v40-cache.js", "js/15-app-v40-navigation.js",
    "js/16-app-v40-composer.js", "js/16a-app-v40-comms-safety.js", "js/16b-app-v40-newswire-manager.js",
    "js/16c-app-v40-newswire-ordering.js",
    *[f"assets/recipes/catalog-v1-part-{i:02d}.js" for i in range(1, 7)],
    "js/17-app-v40-operations-core.js", "js/18-app-v40-operations-ui.js", "js/18a-app-v40-nav-hierarchy.js",
    "js/18b-app-v40-production-pricing.js", "js/18c-app-v40-recipe-corrections.js",
    "js/18d-app-v40-final-ui-polish.js", "js/20-app-v402-fixes.js", "js/19-app-v40-runtime.js",
]


def test_v402(cdp, workspace, node):
    if (workspace, node) == ("command", "overview"):
        states = base.ev(cdp, "(()=>{const f=(verified,stale)=>{window.hasVerifiedTelemetry=()=>verified;dataIsStale=stale;RHWV4.command.updateOverview();RHWV4.v402Fixes.sync();return [v40OverviewTelemetryState.textContent.trim(),v40OverviewTelemetryState.dataset.state]};return{live:f(true,false),cache:f(true,true),offline:f(false,false)}})()")
        if states != {"live": ["LIVE TELEMETRY", "live"], "cache": ["CACHE TELEMETRY", "stale"], "offline": ["AWAITING TELEMETRY", "offline"]}:
            raise RuntimeError(f"V4.0.2 telemetry truth-state failed: {states}")
        cache = base.ev(cdp, "(()=>{lastLoaded=null;updateNetworkFeed('error','test outage');return tickerContainer.textContent})()")
        if "NO VERIFIED CACHE AVAILABLE" not in cache:
            raise RuntimeError(f"V4.0.2 no-cache Newswire state failed: {cache}")
    elif workspace == "operations":
        labels = base.ev(cdp, "(()=>{RHWV4.v402Fixes.sync();return [...document.querySelectorAll('[data-material-price]')].map(x=>x.getAttribute('aria-label')||'')})()")
        if not labels or any(not label.strip() for label in labels):
            raise RuntimeError(f"V4.0.2 calculator accessibility labels failed: {labels}")
    elif (workspace, node) == ("comms", "ticker"):
        labels = base.ev(cdp, "(()=>{RHWV4.v402Fixes.sync();return{ticker:v40TickerOutput.getAttribute('aria-label')||'',newswire:v40NewswireFileOutput.getAttribute('aria-label')||''}})()")
        if not labels["ticker"] or not labels["newswire"]:
            raise RuntimeError(f"V4.0.2 Newswire accessibility labels failed: {labels}")


def main():
    try:
        chrome, browser, port, folder, _log_path = base.launch()
    except Exception as exc:
        print(f"ERROR: {exc}")
        return 1
    print(f"V4.0.2 production smoke browser: {browser}")
    try:
        targets = json.loads(base.get(f"http://127.0.0.1:{port}/json/list", 3))
        page = next(item for item in targets if item.get("type") == "page")
        cdp = base.CDP(page["webSocketDebuggerUrl"])
        try:
            for method in ("Page.enable", "Runtime.enable", "Network.enable"):
                cdp.call(method)
            cdp.call("Network.setBlockedURLs", {"urls": ["https://*", "http://*"]})
            for workspace, node in base.ROUTES:
                cdp.call("Page.navigate", {"url": "about:blank"})
                cdp.call("Page.setDocumentContent", {"frameId": page["id"], "html": base.document(f"{workspace}/{node}")})
                end = time.time() + 8
                snap = {}
                while time.time() < end:
                    snap = base.snapshot(cdp)
                    if snap.get("ready") in {"true", "false"}:
                        break
                    time.sleep(.1)
                key = {"command": "commandNode", "operations": "operationsNode", "comms": "commsNode"}[workspace]
                nav = {"command": "commandNodeNav", "operations": "operationsNodeNav", "comms": "commsNodeNav"}[workspace]
                if snap.get("ready") != "true" or snap.get("error") == "true" or snap.get("workspace") != workspace or snap.get(key) != node or snap.get("mountedNav") != nav or snap.get("errors"):
                    raise RuntimeError(f"V4.0.2 production route failed {workspace}/{node}: {snap}")
                if snap.get("recipes") != 287 or snap.get("products") != 248:
                    raise RuntimeError(f"V4.0.2 corrected catalog mismatch {workspace}/{node}: {snap}")
                test_v402(cdp, workspace, node)
                print(f"V4.0.2 production smoke passed: {workspace}/{node} (287 recipes / 248 products)")
        finally:
            cdp.close()
    finally:
        chrome.terminate()
        try:
            chrome.wait(timeout=3)
        except subprocess.TimeoutExpired:
            chrome.kill()
        shutil.rmtree(folder, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
