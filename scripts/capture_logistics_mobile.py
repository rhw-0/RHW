#!/usr/bin/env python3
from __future__ import annotations

import base64, json, time

import smoke_v40_base as base

for asset in ["js/31-app-command-rework.js", "js/32-app-unified-workspaces.js", "js/33-app-ui-polish-fix.js"]:
    if asset not in base.V4_JS:
        idx = base.V4_JS.index("js/19-app-v40-runtime.js")
        base.V4_JS.insert(idx, asset)

OUT = base.ROOT / "artifacts" / "ui-debug"
OUT.mkdir(parents=True, exist_ok=True)

chrome, browser, port, folder, _log = base.launch()
print(f"UI debug browser: {browser}")
try:
    targets = json.loads(base.get(f"http://127.0.0.1:{port}/json/list", 3))
    page = next(item for item in targets if item.get("type") == "page")
    cdp = base.CDP(page["webSocketDebuggerUrl"])
    try:
        for method in ("Page.enable", "Runtime.enable", "Network.enable", "Log.enable"):
            cdp.call(method)
        cdp.call("Network.setBlockedURLs", {"urls": ["https://*", "http://*"]})
        cdp.call("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 820, "deviceScaleFactor": 1, "mobile": True})
        cdp.call("Page.navigate", {"url": "about:blank"})
        cdp.call("Page.setDocumentContent", {"frameId": page["id"], "html": base.document("command/logistics")})
        end = time.time() + 8
        snap = {}
        while time.time() < end:
            snap = base.snapshot(cdp)
            if snap.get("ready") in {"true", "false"}:
                break
            time.sleep(.1)
        if snap.get("ready") != "true":
            raise RuntimeError(f"RHW failed to boot for visual capture: {snap}")

        metrics = base.ev(cdp, """(()=>{
          const market=document.getElementById('marketScanSection');
          const grid=document.getElementById('marketScanGrid');
          const logistics=document.querySelector('[data-command-panel="logistics"]');
          const external=document.getElementById('externalLogisticsPanel');
          const visible=el=>{if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return !el.hidden&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0&&r.width>0&&r.height>0};
          const r=market?.getBoundingClientRect();
          return{
            workspace:document.body.dataset.workspace,
            node:document.body.dataset.commandNode,
            calculator:document.querySelector('.app-tabs [data-workspace="operations"] > span')?.textContent||'',
            marketExists:!!market,
            marketVisible:visible(market),
            gridVisible:visible(grid),
            marketParent:market?.parentElement?.dataset?.commandPanel||market?.parentElement?.id||'',
            directChild:market?.parentElement===logistics,
            beforeExternal:market?.nextElementSibling===external,
            title:market?.querySelector('.logistics-subhead-title')?.textContent||'',
            kicker:market?.querySelector('.logistics-subhead-kicker')?.textContent||'',
            scope:document.getElementById('rhwMarketScanScope')?.textContent||'',
            gridText:grid?.textContent?.replace(/\\s+/g,' ').trim()||'',
            cards:grid?.querySelectorAll('.market-card').length||0,
            rect:r?{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}:null,
            viewport:{width:innerWidth,height:innerHeight,scrollY:scrollY,docHeight:document.documentElement.scrollHeight},
            failures:RHWV4.uiPolish?.selfTest?.()||[]
          };
        })()""")
        (OUT / "logistics-390.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
        print(json.dumps(metrics, indent=2))

        top = cdp.call("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
        (OUT / "logistics-top-390.png").write_bytes(base64.b64decode(top["data"]))

        base.ev(cdp, "(()=>{document.getElementById('marketScanSection')?.scrollIntoView({block:'start'});return{scrollY}})()")
        time.sleep(.2)
        scan = cdp.call("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
        (OUT / "logistics-scan-390.png").write_bytes(base64.b64decode(scan["data"]))

        if not metrics.get("marketVisible") or not metrics.get("gridVisible") or not metrics.get("directChild"):
            raise RuntimeError(f"Market scan is not actually visible at 390px: {metrics}")
        if metrics.get("title") != "EXTERNAL MARKET SCAN" or "POBS" not in metrics.get("scope", ""):
            raise RuntimeError(f"Market scan visible copy is wrong: {metrics}")
    finally:
        cdp.close()
finally:
    chrome.terminate()
    try:
        chrome.wait(timeout=3)
    except Exception:
        chrome.kill()

print(f"Saved mobile UI debug artifacts to {OUT}")
