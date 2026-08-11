#!/usr/bin/env python3
"""One-time duplicate recipe display-name diagnostic for the V4 release audit."""
from __future__ import annotations

import json
import shutil
import time

import smoke_v40 as base

CORRECTION = "js/18c-app-v40-recipe-corrections.js"
if CORRECTION not in base.V4_JS:
    base.V4_JS.insert(base.V4_JS.index("js/18b-app-v40-production-pricing.js") + 1, CORRECTION)

chrome, browser, port, folder, _log = base.launch()
print(f"V4 recipe-name diagnostic browser: {browser}")
try:
    targets = json.loads(base.get(f"http://127.0.0.1:{port}/json/list", 3))
    page = next(item for item in targets if item.get("type") == "page")
    cdp = base.CDP(page["webSocketDebuggerUrl"])
    try:
        for method in ("Page.enable", "Runtime.enable", "Network.enable"):
            cdp.call(method)
        cdp.call("Network.setBlockedURLs", {"urls": ["https://*", "http://*"]})
        cdp.call("Page.navigate", {"url": "about:blank"})
        cdp.call("Page.setDocumentContent", {"frameId": page["id"], "html": base.document("operations/calculator")})
        end = time.time() + 8
        while time.time() < end:
            snap = base.snapshot(cdp)
            if snap.get("ready") in {"true", "false"}:
                break
            time.sleep(.1)
        data = base.ev(cdp, """(()=>{
          const c=RHWV4.operationsCore;
          const rows=(c.state.catalog?.recipes||[]).map(r=>{
            const alias=RHWV4.operations?.recipeAliases?.[r.id];
            const out=r.outputs?.[0];
            const product=out?c.product(out.id):null;
            const display=alias?.name||product?.name||r.name||r.id;
            return {id:r.id,display,name:r.name||'',craftType:r.craftType||'',sourceType:r.sourceType||'',outputId:out?.id||'',outputQty:out?.qty||0,cookingRate:r.cookingRate||0,creditCost:r.creditCost||0};
          });
          const groups={};
          for(const row of rows){const key=String(row.display||'').trim().toLowerCase();(groups[key]??=[]).push(row)}
          return Object.values(groups).filter(group=>group.length>1).sort((a,b)=>String(a[0].display).localeCompare(String(b[0].display)));
        })()""")
        print("RHW_DUPLICATE_RECIPE_DISPLAY_GROUPS=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    finally:
        cdp.close()
finally:
    chrome.terminate()
    try:
        chrome.wait(timeout=3)
    except Exception:
        chrome.kill()
    shutil.rmtree(folder, ignore_errors=True)
