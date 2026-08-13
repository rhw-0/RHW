#!/usr/bin/env python3
"""Production-order headless-Chrome smoke test for RHW V4.0.2."""
from __future__ import annotations

import json, shutil, subprocess, time

import smoke_v40_base as base

base.V4_CSS = [
    "css/12-app-v40.css", "css/13-app-v40-navigation.css", "css/14-app-v40-composer.css",
    "css/15-app-v40-audit.css", "css/16-app-v40-operations.css", "css/17-app-v40-calculator-polish.css",
    "css/18-app-v40-nav-hierarchy.css", "css/19-app-v402-fixes.css", "css/20-app-v402-qol.css",
]
base.V4_JS = [
    "js/12-app-config.js", "js/13-app-v40.js", "js/14-app-v40-cache.js", "js/15-app-v40-navigation.js",
    "js/16-app-v40-composer.js", "js/16a-app-v40-comms-safety.js", "js/16b-app-v40-newswire-manager.js",
    "js/16c-app-v40-newswire-ordering.js",
    *[f"assets/recipes/catalog-v1-part-{i:02d}.js" for i in range(1, 7)],
    "js/17-app-v40-operations-core.js", "js/18-app-v40-operations-ui.js", "js/18a-app-v40-nav-hierarchy.js",
    "js/18b-app-v40-production-pricing.js", "js/18c-app-v40-recipe-corrections.js",
    "js/18d-app-v40-final-ui-polish.js", "js/20-app-v402-fixes.js", "js/21-app-v402-qol.js",
    "js/19-app-v40-runtime.js",
]
MOBILE_WIDTHS = (360, 390, 412, 430)


def test_boot_failure(cdp, frame_id):
    bootstrap = base.safe((base.ROOT / "js/00-bootstrap.js").read_text(encoding="utf-8"))
    markup = f"""<!doctype html><html><head><meta charset="utf-8"></head><body>
    <script>window.__RHW_BOOTSTRAP_TEST__={{failAsset:'./js/12-app-config.js'}};</script>
    <script>{bootstrap}</script></body></html>"""
    cdp.call("Page.navigate", {"url": "about:blank"})
    cdp.call("Page.setDocumentContent", {"frameId": frame_id, "html": markup})
    end = time.time() + 3
    result = {}
    while time.time() < end:
        result = base.ev(cdp, "({error:document.documentElement.dataset.rhwBootError||'',asset:document.documentElement.dataset.rhwBootAsset||'',text:document.getElementById('rhwBootFailure')?.textContent||'',retry:!!document.querySelector('#rhwBootFailure button')})")
        if result.get("error") == "true":
            break
        time.sleep(.05)
    if result.get("error") != "true" or result.get("asset") != "./js/12-app-config.js" or "COULD NOT START" not in result.get("text", "") or not result.get("retry"):
        raise RuntimeError(f"Visible bootstrap failure UI missing: {result}")
    print("V4.0.2 + PR1 smoke passed: visible bootstrap failure + retry")


def test_mobile_layout(cdp, workspace, node):
    failures = []
    try:
        for width in MOBILE_WIDTHS:
            cdp.call("Emulation.setDeviceMetricsOverride", {
                "width": width, "height": 820, "deviceScaleFactor": 1, "mobile": True,
            })
            time.sleep(.04)
            result = base.ev(cdp, "(()=>{const html=document.documentElement,body=document.body;return{inner:window.innerWidth,html:html.scrollWidth,body:body?.scrollWidth||0,focus:[...document.querySelectorAll('button,input,select,textarea,a[href]')].filter(x=>{const r=x.getBoundingClientRect();return r.width>0&&r.height>0&&r.right>window.innerWidth+2}).slice(0,5).map(x=>x.id||x.className||x.tagName)}})()")
            overflow = max(result.get("html", 0), result.get("body", 0)) - result.get("inner", width)
            if overflow > 2:
                failures.append({"width": width, "overflow": overflow, "elements": result.get("focus", [])})
    finally:
        cdp.call("Emulation.clearDeviceMetricsOverride")
    if failures:
        raise RuntimeError(f"Mobile horizontal overflow {workspace}/{node}: {failures}")


def test_backup_and_storage(cdp):
    result = base.ev(cdp, """(()=>{
      const app=RHWV4,k=app.config.storageKeys;
      const managed=[k.calculatorPriceProfiles,k.shipyardPlanner,k.newswireManagerDraft,k.activeWorkspace];
      const previous=Object.fromEntries(managed.map(key=>[key,localStorage.getItem(key)]));
      const restore=()=>managed.forEach(key=>previous[key]===null?localStorage.removeItem(key):localStorage.setItem(key,previous[key]));
      try{
        app.newswireManager.applyLoadedSource('# RHW Industrial Newswire\n\n## operations\n- [BASE | good] BASE MESSAGE\n','repository');
        app.newswireManager.applyAdd({category:'security',tone:'warn',tag:'RECOVERY TEST',message:'DURABLE LOCAL DRAFT'});
        app.store.set(k.calculatorPriceProfiles,[{id:'pr1-profile',name:'PR1 Market',prices:{steel:1234},updatedAt:42}]);
        app.store.set(k.shipyardPlanner,{target:'dunkirk',quantity:3});
        app.store.set(k.activeWorkspace,'comms');
        const payload=app.storage.exportPayload();
        managed.forEach(key=>localStorage.removeItem(key));
        const imported=app.storage.importPayload(payload);
        const restoredDraft=app.store.get(k.newswireManagerDraft,null);
        const legacy={format:'rhw-webapp-local-cache',version:1,current:payload.current,drafts:[],localSenders:[]};
        const legacyResult=app.storage.importPayload(legacy);
        app.reportStorageFailure('Smoke test','pr1-smoke',new Error('EXPECTED'));
        const warning={shown:document.documentElement.dataset.rhwStorageError==='true',button:!!document.querySelector('#rhwStorageWarning button')};
        app.clearStorageWarning();
        const value={
          version:payload.version,
          profile:app.store.get(k.calculatorPriceProfiles,[])[0]?.name||'',
          planner:app.store.get(k.shipyardPlanner,null),
          draft:restoredDraft?.entries?.some(entry=>entry.tag==='RECOVERY TEST')||false,
          changed:app.newswireManager.state.draftSourceChanged,
          imported,legacy:legacyResult,warning
        };
        app.newswireManager.resetWorkingCopy({announce:false});
        restore();
        return value;
      }catch(error){
        try{app.newswireManager.resetWorkingCopy({announce:false});app.clearStorageWarning();restore()}catch{}
        return{error:String(error?.stack||error)};
      }
    })()""")
    if result.get("error") or result.get("version") != 2 or result.get("profile") != "PR1 Market" or result.get("planner", {}).get("quantity") != 3 or not result.get("draft") or not all(result.get("warning", {}).values()) or "legacy" not in result:
        raise RuntimeError(f"V2 local backup / storage warning failed: {result}")
    print("V4.0.2 + PR1 smoke passed: V2 backup, V1 import, durable Newswire draft, storage warning")


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


def test_qol_profiles(cdp):
    mounted = base.ev(cdp, "({panel:!!document.getElementById('opsPriceProfiles'),qol:!!RHWV4.qol,plannerKey:!!RHWV4.config.storageKeys.shipyardPlanner,profileKey:!!RHWV4.config.storageKeys.calculatorPriceProfiles})")
    if not all(mounted.values()):
        raise RuntimeError(f"QoL calculator mounts missing: {mounted}")
    result = base.ev(cdp, "(()=>{try{const key=RHWV4.config.storageKeys.calculatorPriceProfiles,baseGet=RHWV4.store.get.bind(RHWV4.store),baseSet=RHWV4.store.set.bind(RHWV4.store);let memory=[];RHWV4.store.get=(k,f)=>k===key?memory:baseGet(k,f);RHWV4.store.set=(k,v)=>{if(k===key){memory=v;return true}return baseSet(k,v)};const inputs=[...document.querySelectorAll('[data-material-price]')],name=document.getElementById('opsPriceProfileName'),save=document.getElementById('opsPriceProfileSave'),select=document.getElementById('opsPriceProfileSelect'),load=document.getElementById('opsPriceProfileLoad');if(!name||!save||!select||!load)return{error:'profile controls missing'};inputs.forEach((i,n)=>{i.value=String(1200+n);i.dispatchEvent(new Event('input',{bubbles:true}))});name.value='Smoke Market';save.click();const saved=RHWV4.qol.profiles().find(p=>p.name==='Smoke Market');inputs.forEach(i=>{i.value='';i.dispatchEvent(new Event('input',{bubbles:true}))});select.value=saved?.id||'';select.dispatchEvent(new Event('change',{bubbles:true}));load.click();const restored=inputs.map(i=>i.value);RHWV4.store.get=baseGet;RHWV4.store.set=baseSet;return{saved:!!saved,restored,count:inputs.length}}catch(e){return{error:String(e&&e.stack||e)}}})()")
    if not result.get("saved") or result.get("count", 0) <= 0 or any(not value for value in result.get("restored", [])):
        raise RuntimeError(f"Explicit price profile save/load failed: {result}")
    print("V4 interaction smoke passed: explicit Calculator price profiles")


def test_qol_shipyard(cdp):
    result = base.ev(cdp, "(()=>{window.hasVerifiedTelemetry=()=>true;window.stockFor=()=>50000;if(typeof renderShipyardControl==='function')renderShipyardControl();RHWV4.qol.ensureShipyardPlanner();const panel=document.getElementById('shipyardBuildPlanner');if(!panel)return{ok:false};const qty=document.getElementById('shipyardPlanQuantity'),target=document.getElementById('shipyardPlanTarget'),button=document.getElementById('shipyardPlanOpenCalculator');qty.value='3';qty.dispatchEvent(new Event('input',{bubbles:true}));const targetText=target.textContent;const rows=document.querySelectorAll('.shipyard-plan-component-row').length;button.click();return{ok:true,target:targetText,rows,hash:location.hash,qty:document.getElementById('opsQuantity')?.value||'',ws:document.body.dataset.workspace}})()")
    if not result.get("ok") or result.get("rows", 0) <= 0 or "3" not in result.get("target", "") or result.get("hash") != "#operations/calculator" or result.get("qty") != "3" or result.get("ws") != "operations":
        raise RuntimeError(f"Shipyard multi-hull planner failed: {result}")
    print("V4 interaction smoke passed: Shipyard multi-hull planner → Calculator")


def run_interactions(cdp, workspace, node):
    if (workspace, node) == ("command", "overview"):
        base.test_overview(cdp)
    elif (workspace, node) == ("command", "shipyard"):
        test_qol_shipyard(cdp)
    elif (workspace, node) == ("command", "production"):
        base.test_production_bridge(cdp)
    elif workspace == "operations":
        base.test_calculator(cdp)
        test_qol_profiles(cdp)
    elif (workspace, node) == ("comms", "forum"):
        base.test_comms(cdp)
    elif (workspace, node) == ("comms", "ticker"):
        base.test_ticker(cdp)
        test_backup_and_storage(cdp)


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
            for method in ("Page.enable", "Runtime.enable", "Network.enable", "Log.enable"):
                cdp.call(method)
            cdp.call("Network.setBlockedURLs", {"urls": ["https://*", "http://*"]})
            test_boot_failure(cdp, page["id"])
            cdp.take_runtime_failures()
            for workspace, node in base.ROUTES:
                cdp.call("Page.navigate", {"url": "about:blank"})
                cdp.take_runtime_failures()
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
                run_interactions(cdp, workspace, node)
                test_mobile_layout(cdp, workspace, node)
                cdp.call("Runtime.evaluate", {"expression": "void 0"})
                runtime_failures = [
                    failure for failure in cdp.take_runtime_failures()
                    if not ("TypeError: Failed to fetch" in failure and "fetchWithTimeout" in failure)
                ]
                if runtime_failures:
                    raise RuntimeError(f"Browser console/runtime errors {workspace}/{node}: {runtime_failures}")
                print(f"V4.0.2 + PR1 smoke passed: {workspace}/{node} (287 recipes / 248 products; mobile 360/390/412/430)")
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
