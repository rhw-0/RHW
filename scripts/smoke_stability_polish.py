#!/usr/bin/env python3
"""Focused RHW stability smoke: important mobile tools must be discoverable, not merely mounted."""
from __future__ import annotations

import json
import time

import smoke_v40 as harness
import smoke_v40_base as base
import smoke_v402  # noqa: F401  # installs the production CSS/JS asset matrix

# smoke_v402 replaces the base asset list during import; put the final app layers
# back in the exact production order before creating the test document.
harness._ensure_app_layer_assets()


def main() -> int:
    try:
        chrome, browser, port, folder, _log_path = base.launch()
    except Exception as exc:
        print(f"ERROR: {exc}")
        return 1

    try:
        targets = json.loads(base.get(f"http://127.0.0.1:{port}/json/list", 3))
        page = next(item for item in targets if item.get("type") == "page")
        cdp = base.CDP(page["webSocketDebuggerUrl"])
        try:
            for method in ("Page.enable", "Runtime.enable", "Network.enable", "Log.enable"):
                cdp.call(method)
            cdp.call("Network.setBlockedURLs", {"urls": ["https://*", "http://*"]})
            cdp.call("Emulation.setDeviceMetricsOverride", {
                "width": 390, "height": 820, "deviceScaleFactor": 1, "mobile": True,
            })
            cdp.call("Page.navigate", {"url": "about:blank"})
            cdp.call("Page.setDocumentContent", {
                "frameId": page["id"],
                "html": base.document("command/logistics"),
            })

            end = time.time() + 9
            snap = {}
            while time.time() < end:
                snap = base.snapshot(cdp)
                if snap.get("ready") in {"true", "false"}:
                    break
                time.sleep(.1)
            if snap.get("ready") != "true" or snap.get("workspace") != "command" or snap.get("commandNode") != "logistics" or snap.get("errors"):
                raise RuntimeError(f"Stability route did not boot: {snap}")

            time.sleep(.22)
            result = base.ev(cdp, """(()=>{
              const visible=element=>{
                if(!element)return false;
                const style=getComputedStyle(element),rect=element.getBoundingClientRect();
                return style.display!=='none'&&style.visibility!=='hidden'&&style.opacity!=='0'&&rect.width>0&&rect.height>0;
              };
              const rect=element=>{
                const r=element?.getBoundingClientRect();
                return r?{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}:{top:9999,bottom:9999,left:0,right:0,width:0,height:0};
              };
              const nav=document.getElementById('rhwLogisticsViewNav');
              const market=document.getElementById('marketScanSection');
              const fixed=document.getElementById('fixedLogisticsSection');
              const marketTab=nav?.querySelector('[data-logistics-view="market"]');
              const fixedTab=nav?.querySelector('[data-logistics-view="fixed"]');
              const context=document.getElementById('commandContextAction');
              const title=document.getElementById('marketScanTitle');
              const price=document.querySelector('[data-market-sort="price"]');
              const stock=document.querySelector('[data-market-sort="stock"]');
              const dock=document.querySelector('.app-tabs');
              const dockTop=rect(dock).top<9999?rect(dock).top:window.innerHeight;
              const initial={
                view:document.body.dataset.logisticsView||'',
                navVisible:visible(nav),navRect:rect(nav),
                marketVisible:visible(market),marketRect:rect(market),
                fixedVisible:visible(fixed),
                titleVisible:visible(title),titleRect:rect(title),
                priceVisible:visible(price),priceRect:rect(price),
                stockVisible:visible(stock),stockRect:rect(stock),
                dockTop,
                marketSelected:marketTab?.getAttribute('aria-selected')||'',
                fixedSelected:fixedTab?.getAttribute('aria-selected')||'',
                tabHeights:[marketTab,fixedTab].map(x=>x?.getBoundingClientRect().height||0),
                contextVisible:visible(context),
                calculator:document.querySelector('.app-tabs [data-workspace="operations"] > span')?.textContent?.trim()||'',
                scrollY:window.scrollY,
                overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth,
                failures:RHWV4.stabilityPolish?.selfTest?.()||[]
              };
              fixedTab?.click();
              const fixedState={view:document.body.dataset.logisticsView||'',marketVisible:visible(market),fixedVisible:visible(fixed),selected:fixedTab?.getAttribute('aria-selected')||''};
              marketTab?.click();
              const marketState={view:document.body.dataset.logisticsView||'',marketVisible:visible(market),fixedVisible:visible(fixed),selected:marketTab?.getAttribute('aria-selected')||''};
              return{initial,fixedState,marketState};
            })()""")

            initial = result.get("initial", {})
            if initial.get("failures"):
                raise RuntimeError(f"Stability self-test failed: {result}")
            if initial.get("calculator") != "CALCULATOR":
                raise RuntimeError(f"Workspace label regression: {result}")
            if initial.get("view") != "market" or not initial.get("navVisible") or not initial.get("marketVisible") or initial.get("fixedVisible"):
                raise RuntimeError(f"Market Scan is not the default visible Logistics tool: {result}")
            if initial.get("marketSelected") != "true" or initial.get("fixedSelected") != "false":
                raise RuntimeError(f"Logistics tab state is inconsistent: {result}")
            if any(height < 43.5 for height in initial.get("tabHeights", [])):
                raise RuntimeError(f"Logistics touch target too small: {result}")
            if initial.get("contextVisible"):
                raise RuntimeError(f"Redundant Inventory cross-link still blocks Logistics: {result}")

            dock_top = initial.get("dockTop", 820)
            nav_rect = initial.get("navRect", {})
            title_rect = initial.get("titleRect", {})
            price_rect = initial.get("priceRect", {})
            stock_rect = initial.get("stockRect", {})
            if (nav_rect.get("top", 9999) < 0 or nav_rect.get("bottom", 9999) > dock_top - 8
                    or not initial.get("titleVisible") or title_rect.get("top", 9999) < 0 or title_rect.get("bottom", 9999) > dock_top - 8
                    or not initial.get("priceVisible") or price_rect.get("top", 9999) < 0 or price_rect.get("bottom", 9999) > dock_top - 8
                    or not initial.get("stockVisible") or stock_rect.get("top", 9999) < 0 or stock_rect.get("bottom", 9999) > dock_top - 8):
                raise RuntimeError(f"Market Scan title/sort controls are not fully usable above the mobile dock: {result}")
            if initial.get("overflow", 0) > 2:
                raise RuntimeError(f"Logistics mobile horizontal overflow: {result}")

            fixed_state = result.get("fixedState", {})
            if fixed_state != {"view": "fixed", "marketVisible": False, "fixedVisible": True, "selected": "true"}:
                raise RuntimeError(f"Fixed Links switch failed: {result}")
            market_state = result.get("marketState", {})
            if market_state != {"view": "market", "marketVisible": True, "fixedVisible": False, "selected": "true"}:
                raise RuntimeError(f"Market Scan switch-back failed: {result}")

            runtime_failures = [
                failure for failure in cdp.take_runtime_failures()
                if not ("TypeError: Failed to fetch" in failure and "fetchWithTimeout" in failure)
            ]
            if runtime_failures:
                raise RuntimeError(f"Browser console/runtime errors: {runtime_failures}")

            print("RHW stability smoke passed: 390px Logistics exposes Market Scan title + sort controls above the mobile dock and switches to fixed links cleanly")
            return 0
        finally:
            try:
                cdp.call("Emulation.clearDeviceMetricsOverride")
            except Exception:
                pass
            cdp.close()
    finally:
        chrome.terminate()
        try:
            chrome.wait(timeout=3)
        except Exception:
            chrome.kill()
        try:
            folder.cleanup()
        except Exception:
            pass


if __name__ == '__main__':
    raise SystemExit(main())
