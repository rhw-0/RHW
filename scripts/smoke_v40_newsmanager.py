#!/usr/bin/env python3
"""Focused browser smoke for the V4 Newswire file editor and ordering controls."""
from __future__ import annotations

import json
import shutil
import sys
import time

import smoke_v40 as base

ORDERING = "js/16c-app-v40-newswire-ordering.js"
if ORDERING not in base.V4_JS:
    index = base.V4_JS.index("js/16b-app-v40-newswire-manager.js") + 1
    base.V4_JS.insert(index, ORDERING)


def main() -> int:
    try:
        chrome, browser, port, folder, _log_path = base.launch()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    print(f"V4 Newswire smoke browser: {browser}")
    try:
        targets = json.loads(base.get(f"http://127.0.0.1:{port}/json/list", 3))
        page = next(item for item in targets if item.get("type") == "page")
        cdp = base.CDP(page["webSocketDebuggerUrl"])
        try:
            for method in ("Page.enable", "Runtime.enable", "Network.enable"):
                cdp.call(method)
            cdp.call("Network.setBlockedURLs", {"urls": ["https://*", "http://*"]})
            cdp.call("Page.navigate", {"url": "about:blank"})
            cdp.call("Page.setDocumentContent", {"frameId": page["id"], "html": base.document("comms/ticker")})

            end = time.time() + 8
            snap = {}
            while time.time() < end:
                snap = base.snapshot(cdp)
                if snap.get("ready") in {"true", "false"}:
                    break
                time.sleep(.1)
            if snap.get("ready") != "true" or snap.get("error") == "true" or snap.get("errors"):
                raise RuntimeError(f"Newswire ordering route boot failed: {snap}")

            setup = base.ev(cdp, """(()=>{
              const m=RHWV4.newswireManager,o=RHWV4.newswireOrdering;
              if(!m||!o)return{ok:false,reason:'manager/ordering missing'};
              m.applyLoadedSource('# RHW Industrial Newswire\\n\\n## market\\n- [MARKET A | lore] FIRST MARKET\\n- [MARKET B | lore] SECOND MARKET\\n\\n## operations\\n- [OPS TEST | good] OPS MESSAGE\\n','fallback');
              window.__RHW_POOL_BEFORE__=typeof activeNewswirePools!=='undefined'?JSON.stringify(activeNewswirePools):'';
              return{
                ok:true,liveBridge:!!RHWV4.newswireLiveBridge,
                reset:v40NewswireResetBtn.textContent,reload:v40NewswireReloadBtn.textContent,
                resetFont:parseFloat(getComputedStyle(v40NewswireResetBtn).fontSize)||0,
                resetColor:getComputedStyle(v40NewswireResetBtn).color,
                resetBg:getComputedStyle(v40NewswireResetBtn).backgroundColor,
                note:document.getElementById('v40NewswireOrderNote')?.textContent||''
              };
            })()""")
            time.sleep(.15)
            if not setup.get("ok") or setup.get("liveBridge") or setup.get("reset") != "RESET TO CURRENT FILE" or setup.get("reload") != "RELOAD CURRENT FILE" or setup.get("resetFont", 0) < 9 or "UP" not in setup.get("note", ""):
                raise RuntimeError(f"Newswire file-editor setup failed: {setup}")

            typing = base.ev(cdp, """(()=>{
              v40TickerCategory.value='market';v40TickerTone.value='warn';v40TickerTag.value='NEW MARKET';
              v40TickerMessage.value='HELLO ';
              v40TickerMessage.dispatchEvent(new Event('input',{bubbles:true}));
              const afterSpace=v40TickerMessage.value;
              v40TickerMessage.value+='WORLD';
              v40TickerMessage.dispatchEvent(new Event('input',{bubbles:true}));
              v40NewswireSaveBtn.click();
              return{afterSpace};
            })()""")
            if typing.get("afterSpace") != "HELLO ":
                raise RuntimeError(f"Ticker space typing regression: {typing}")

            time.sleep(.2)
            added = base.ev(cdp, """(()=>{
              const m=RHWV4.newswireManager;
              const markets=m.state.entries.filter(x=>x.category==='market').map(x=>x.tag);
              const entry=m.state.entries.find(x=>x.tag==='NEW MARKET');
              const row=entry?document.querySelector(`[data-newswire-id=\"${entry.id}\"]`):null;
              return{
                found:!!entry,dirty:m.state.dirty,markets,
                up:!!row?.querySelector('[data-newswire-up]'),down:!!row?.querySelector('[data-newswire-down]'),
                banner:v40NewswirePublishState.textContent,
                poolSame:(typeof activeNewswirePools==='undefined')?true:JSON.stringify(activeNewswirePools)===window.__RHW_POOL_BEFORE__
              };
            })()""")
            if not added.get("found") or not added.get("dirty") or added.get("markets", [None])[0] != "NEW MARKET" or not added.get("up") or not added.get("down") or "LOCAL EDITS" not in added.get("banner", "") or not added.get("poolSame"):
                raise RuntimeError(f"Newswire add/top-order/no-live-integration failed: {added}")

            moved = base.ev(cdp, """(()=>{
              const m=RHWV4.newswireManager;
              const entry=m.state.entries.find(x=>x.tag==='NEW MARKET');
              const row=entry?document.querySelector(`[data-newswire-id=\"${entry.id}\"]`):null;
              row?.querySelector('[data-newswire-down]')?.click();
              return{clicked:!!row};
            })()""")
            if not moved.get("clicked"):
                raise RuntimeError(f"Newswire order button missing: {moved}")
            time.sleep(.15)
            order = base.ev(cdp, """(()=>({
              markets:RHWV4.newswireManager.state.entries.filter(x=>x.category==='market').map(x=>x.tag),
              source:v40NewswireFileOutput.value,
              poolSame:(typeof activeNewswirePools==='undefined')?true:JSON.stringify(activeNewswirePools)===window.__RHW_POOL_BEFORE__
            }))()""")
            if order.get("markets") != ["MARKET A", "NEW MARKET", "MARKET B"] or "[MARKET A | lore] FIRST MARKET" not in order.get("source", "") or "[NEW MARKET | warn] HELLO WORLD" not in order.get("source", "") or not order.get("poolSame"):
                raise RuntimeError(f"Newswire within-category ordering failed: {order}")

            reset = base.ev(cdp, """(()=>{
              const m=RHWV4.newswireManager;
              window.confirm=()=>true;
              v40NewswireResetBtn.click();
              return{exists:m.state.entries.some(x=>x.tag==='NEW MARKET'),dirty:m.state.dirty,count:m.state.entries.length};
            })()""")
            if reset.get("exists") or reset.get("dirty") or reset.get("count") != 3:
                raise RuntimeError(f"Newswire file reset failed: {reset}")

            print("V4 interaction smoke passed: Newswire file editor + ordering + readable reset")
        finally:
            cdp.close()
    finally:
        chrome.terminate()
        try:
            chrome.wait(timeout=3)
        except Exception:
            chrome.kill()
        shutil.rmtree(folder, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())