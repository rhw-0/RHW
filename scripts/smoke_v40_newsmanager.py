#!/usr/bin/env python3
"""Focused browser smoke for the V4 Newswire working-copy/live-preview bridge."""
from __future__ import annotations

import json
import shutil
import sys
import time

import smoke_v40 as base

BRIDGE = "js/16c-app-v40-newswire-live-bridge.js"
if BRIDGE not in base.V4_JS:
    index = base.V4_JS.index("js/16b-app-v40-newswire-manager.js") + 1
    base.V4_JS.insert(index, BRIDGE)


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
                raise RuntimeError(f"Newswire bridge route boot failed: {snap}")

            setup = base.ev(cdp, """(()=>{
              const m=RHWV4.newswireManager,b=RHWV4.newswireLiveBridge;
              if(!m||!b)return{ok:false,reason:'manager/bridge missing'};
              m.applyLoadedSource('# RHW Industrial Newswire\\n\\n## market\\n- [MARKET TEST | lore] MARKET MESSAGE\\n\\n## operations\\n- [OPS TEST | good] OPS MESSAGE\\n','fallback');
              window.__RHW_CAPTURED_POOLS__=null;
              try{
                const original=applyNewswirePools;
                applyNewswirePools=function(pools){window.__RHW_CAPTURED_POOLS__=JSON.parse(JSON.stringify(pools));return original(pools)};
                window.applyNewswirePools=applyNewswirePools;
              }catch(e){return{ok:false,reason:'pool hook failed',error:String(e)}}
              b.applyWorkingCopyToTicker({force:true});
              return{ok:true,reload:v40NewswireReloadBtn.textContent,reset:v40NewswireResetBtn.textContent,font:parseFloat(getComputedStyle(v40NewswireReloadBtn).fontSize)||0};
            })()""")
            if not setup.get("ok") or "PUBLISHED" not in setup.get("reload", "") or "PUBLISHED" not in setup.get("reset", "") or setup.get("font", 0) < 9:
                raise RuntimeError(f"Newswire bridge setup failed: {setup}")

            typing = base.ev(cdp, """(()=>{
              v40TickerCategory.value='security';v40TickerTone.value='warn';v40TickerTag.value='RHW LIVE TEST';
              v40TickerMessage.value='HELLO ';
              v40TickerMessage.dispatchEvent(new Event('input',{bubbles:true}));
              const afterSpace=v40TickerMessage.value;
              v40TickerMessage.value+='WORLD';
              v40TickerMessage.dispatchEvent(new Event('input',{bubbles:true}));
              v40NewswireSaveBtn.click();
              return{afterSpace,final:v40TickerMessage.value};
            })()""")
            if typing.get("afterSpace") != "HELLO ":
                raise RuntimeError(f"Ticker space typing regression: {typing}")

            time.sleep(.15)
            added = base.ev(cdp, """(()=>{
              const m=RHWV4.newswireManager;
              const entry=m.state.entries.find(x=>x.tag==='RHW LIVE TEST');
              const pools=window.__RHW_CAPTURED_POOLS__||{};
              return{
                found:!!entry,dirty:m.state.dirty,count:m.state.entries.length,
                banner:v40NewswirePublishState.textContent,hint:v40NewswirePublishHint.textContent,
                captured:(pools.security||[]).map(x=>x.text),
                reload:v40NewswireReloadBtn.textContent
              };
            })()""")
            if not added.get("found") or not added.get("dirty") or "LOCAL EDITS" not in added.get("banner", "") or "LIVE TICKER ABOVE" not in added.get("hint", "") or "HELLO WORLD" not in added.get("captured", []):
                raise RuntimeError(f"Newswire local live-preview bridge failed: {added}")

            protected = base.ev(cdp, """(()=>{
              const m=RHWV4.newswireManager;
              window.confirm=()=>true;
              const before=m.state.entries.length;
              v40NewswireReloadBtn.click();
              return{before,after:m.state.entries.length,exists:m.state.entries.some(x=>x.tag==='RHW LIVE TEST'),dirty:m.state.dirty};
            })()""")
            time.sleep(.1)
            if protected.get("after") != protected.get("before") or not protected.get("exists") or not protected.get("dirty"):
                raise RuntimeError(f"Reload must protect local Newswire edits: {protected}")

            reset = base.ev(cdp, """(()=>{
              const m=RHWV4.newswireManager;
              window.confirm=()=>true;
              v40NewswireResetBtn.click();
              return{exists:m.state.entries.some(x=>x.tag==='RHW LIVE TEST'),dirty:m.state.dirty,count:m.state.entries.length};
            })()""")
            if reset.get("exists") or reset.get("dirty") or reset.get("count") != 2:
                raise RuntimeError(f"Explicit Newswire reset failed: {reset}")

            print("V4 interaction smoke passed: Newswire local live ticker + reload protection")
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
