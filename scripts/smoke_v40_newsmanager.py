#!/usr/bin/env python3
"""Focused browser smoke for the V4 Newswire file editor, filters and ordering."""
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
            if not setup.get("ok") or setup.get("liveBridge") or setup.get("reset") != "RESET TO CURRENT FILE" or setup.get("reload") != "RELOAD CURRENT FILE" or setup.get("resetFont", 0) < 9 or "UP" not in setup.get("note", "") or "FILTER" not in setup.get("note", ""):
                raise RuntimeError(f"Newswire file-editor setup failed: {setup}")

            time.sleep(.2)
            categories = base.ev(cdp, """(()=>({
              filters:[...document.querySelectorAll('[data-newswire-filter]')].map(x=>({key:x.dataset.newswireFilter,text:x.textContent,active:x.classList.contains('active')})),
              dividers:[...document.querySelectorAll('.v40-newswire-category-divider')].map(x=>x.textContent.replace(/\\s+/g,' ').trim()),
              badges:[...document.querySelectorAll('.v40-newswire-entry-meta span:first-child')].map(x=>x.textContent.trim()),
              active:RHWV4.newswireOrdering.activeFilter
            }))()""")
            if len(categories.get("filters", [])) != 6 or categories.get("filters", [])[0].get("key") != "all" or not categories.get("filters", [])[0].get("active") or categories.get("active") != "all":
                raise RuntimeError(f"Newswire category filters missing: {categories}")
            if not any("MARKET" in value and "2 BULLETINS" in value for value in categories.get("dividers", [])) or not any("OPERATIONS" in value and "1 BULLETIN" in value for value in categories.get("dividers", [])):
                raise RuntimeError(f"Newswire category dividers missing: {categories}")

            base.ev(cdp, "document.querySelector('[data-newswire-filter=\"market\"]')?.click()")
            time.sleep(.1)
            market_filter = base.ev(cdp, """(()=>({
              active:RHWV4.newswireOrdering.activeFilter,
              visible:[...document.querySelectorAll('.v40-newswire-entry')].filter(x=>!x.hidden).map(x=>x.querySelector('.v40-newswire-entry-id strong')?.textContent||''),
              dividers:[...document.querySelectorAll('.v40-newswire-category-divider')].map(x=>x.textContent.replace(/\\s+/g,' ').trim()),
              pressed:document.querySelector('[data-newswire-filter=\"market\"]')?.getAttribute('aria-pressed')
            }))()""")
            if market_filter.get("active") != "market" or market_filter.get("visible") != ["MARKET A", "MARKET B"] or market_filter.get("pressed") != "true" or len(market_filter.get("dividers", [])) != 1:
                raise RuntimeError(f"Newswire MARKET filter failed: {market_filter}")

            base.ev(cdp, "document.querySelector('[data-newswire-filter=\"operations\"]')?.click()")
            time.sleep(.1)
            operations_filter = base.ev(cdp, """(()=>({
              active:RHWV4.newswireOrdering.activeFilter,
              visible:[...document.querySelectorAll('.v40-newswire-entry')].filter(x=>!x.hidden).map(x=>x.querySelector('.v40-newswire-entry-id strong')?.textContent||'')
            }))()""")
            if operations_filter.get("active") != "operations" or operations_filter.get("visible") != ["OPS TEST"]:
                raise RuntimeError(f"Newswire OPERATIONS filter failed: {operations_filter}")

            base.ev(cdp, "document.querySelector('[data-newswire-filter=\"all\"]')?.click()")
            time.sleep(.1)

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
                marketFilter:document.querySelector('[data-newswire-filter=\"market\"]')?.textContent||'',
                allFilter:document.querySelector('[data-newswire-filter=\"all\"]')?.textContent||'',
                divider:[...document.querySelectorAll('.v40-newswire-category-divider')].map(x=>x.textContent.replace(/\\s+/g,' ').trim()).find(x=>x.startsWith('MARKET'))||'',
                poolSame:(typeof activeNewswirePools==='undefined')?true:JSON.stringify(activeNewswirePools)===window.__RHW_POOL_BEFORE__
              };
            })()""")
            if not added.get("found") or not added.get("dirty") or added.get("markets", [None])[0] != "NEW MARKET" or not added.get("up") or not added.get("down") or "LOCAL EDITS" not in added.get("banner", "") or not added.get("poolSame") or "// 3" not in added.get("marketFilter", "") or "// 4" not in added.get("allFilter", "") or "3 BULLETINS" not in added.get("divider", ""):
                raise RuntimeError(f"Newswire add/top-order/filter-count failed: {added}")

            moved = base.ev(cdp, """(()=>{
              document.querySelector('[data-newswire-filter=\"market\"]')?.click();
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
              visible:[...document.querySelectorAll('.v40-newswire-entry')].filter(x=>!x.hidden).map(x=>x.querySelector('.v40-newswire-entry-id strong')?.textContent||''),
              source:v40NewswireFileOutput.value,
              poolSame:(typeof activeNewswirePools==='undefined')?true:JSON.stringify(activeNewswirePools)===window.__RHW_POOL_BEFORE__
            }))()""")
            if order.get("markets") != ["MARKET A", "NEW MARKET", "MARKET B"] or order.get("visible") != ["MARKET A", "NEW MARKET", "MARKET B"] or "[MARKET A | lore] FIRST MARKET" not in order.get("source", "") or "[NEW MARKET | warn] HELLO WORLD" not in order.get("source", "") or not order.get("poolSame"):
                raise RuntimeError(f"Newswire within-category filtered ordering failed: {order}")

            reset = base.ev(cdp, """(()=>{
              const m=RHWV4.newswireManager;
              window.confirm=()=>true;
              v40NewswireResetBtn.click();
              return{exists:m.state.entries.some(x=>x.tag==='NEW MARKET'),dirty:m.state.dirty,count:m.state.entries.length};
            })()""")
            if reset.get("exists") or reset.get("dirty") or reset.get("count") != 3:
                raise RuntimeError(f"Newswire file reset failed: {reset}")

            print("V4 interaction smoke passed: Newswire file editor + category filters/dividers + ordering")
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