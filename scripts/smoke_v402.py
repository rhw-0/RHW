#!/usr/bin/env python3
"""Production-order headless-Chrome smoke test for RHW V4.0.2."""
from __future__ import annotations

import json, shutil, subprocess, time

import smoke_v40_base as base

base.V4_CSS = [
    "css/12-app-v40.css", "css/13-app-v40-navigation.css", "css/14-app-v40-composer.css",
    "css/15-app-v40-audit.css", "css/16-app-v40-operations.css", "css/17-app-v40-calculator-polish.css",
    "css/18-app-v40-nav-hierarchy.css", "css/19-app-v402-fixes.css", "css/20-app-v402-qol.css",
    "css/21-app-v402-mobile-ui.css", "css/22-app-pr3-command-mobile.css",
    "css/23-app-pr3-yard-production.css", "css/24-app-pr3-operations-calculator.css",
    "css/25-app-pr3-comms-workflow.css", "css/26-app-pr3-newswire-manager.css",
    "css/27-app-pr4-pwa.css",
]
base.V4_JS = [
    "js/12-app-config.js", "js/13-app-v40.js", "js/14-app-v40-cache.js", "js/15-app-v40-navigation.js",
    "js/16-app-v40-composer.js", "js/16a-app-v40-comms-safety.js", "js/16b-app-v40-newswire-manager.js",
    "js/16c-app-v40-newswire-ordering.js",
    *[f"assets/recipes/catalog-v1-part-{i:02d}.js" for i in range(1, 7)],
    "js/17-app-v40-operations-core.js", "js/18-app-v40-operations-ui.js", "js/18a-app-v40-nav-hierarchy.js",
    "js/18b-app-v40-production-pricing.js", "js/18c-app-v40-recipe-corrections.js",
    "js/18d-app-v40-final-ui-polish.js", "js/20-app-v402-fixes.js", "js/21-app-v402-qol.js",
    "js/22-app-v402-mobile-ui.js", "js/23-app-v40-pwa.js", "js/19-app-v40-runtime.js",
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
    print("V4.0.2 + PR2 smoke passed: visible bootstrap failure + retry")


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


def test_mobile_forum_controls(cdp):
    cdp.call("Emulation.setDeviceMetricsOverride", {
        "width": 390, "height": 820, "deviceScaleFactor": 1, "mobile": True,
    })
    try:
        time.sleep(.08)
        result = base.ev(cdp, """(()=>{
          const visible=element=>{const style=getComputedStyle(element),rect=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0};
          const controls=document.getElementById('commsMobileViewSwitch');
          const dock=document.querySelector('.app-tabs');
          const context=document.getElementById('appContextNavSlot');
          if(!controls||!RHWV4.mobileUi)return{error:'mobile controls missing'};
          commsSubject.value='RHW MOBILE UI TEST';
          commsMessage.value='Mobile composer and forum BBCode remain synchronized.';
          [commsSubject,commsMessage].forEach(input=>input.dispatchEvent(new Event('input',{bubbles:true})));
          RHWV4.mobileUi.setForumView('preview');
          const preview={
            composer:visible(commsComposerPanel),
            panel:visible(document.querySelector('.preview-panel')),
            text:forumLivePreview.textContent
          };
          RHWV4.mobileUi.setForumView('bbcode');
          const bbcode={
            panel:visible(document.querySelector('.bbcode-panel')),
            output:visible(forumBbcodeOutput),
            value:forumBbcodeOutput.value
          };
          const touch=[...document.querySelectorAll('.rhw-app-nav button,.comms-mobile-view-switch button')]
            .filter(visible).map(element=>({name:element.textContent.trim(),height:element.getBoundingClientRect().height}))
            .filter(item=>item.height<43.5);
          document.querySelector('.app-tabs [data-workspace="operations"]')?.click();
          const operations=document.body.dataset.workspace;
          document.querySelector('.app-tabs [data-workspace="comms"]')?.click();
          const comms=document.body.dataset.workspace;
          RHWV4.mobileUi.setForumView('write');
          return{
            mode:document.documentElement.dataset.rhwMobileUi,
            dock:{position:getComputedStyle(dock).position,height:dock.getBoundingClientRect().height},
            context:{position:getComputedStyle(context).position,height:context.getBoundingClientRect().height},
            preview,bbcode,touch,operations,comms,
            activeView:document.body.dataset.commsMobileView
          };
        })()""")
    finally:
        cdp.call("Emulation.clearDeviceMetricsOverride")
    if result.get("error") or result.get("mode") != "true" or result.get("dock", {}).get("position") != "fixed" or result.get("dock", {}).get("height", 0) < 54:
        raise RuntimeError(f"Mobile workspace dock failed: {result}")
    if result.get("context", {}).get("height", 0) < 44 or result.get("touch") or result.get("operations") != "operations" or result.get("comms") != "comms":
        raise RuntimeError(f"Mobile navigation / touch targets failed: {result}")
    preview, bbcode = result.get("preview", {}), result.get("bbcode", {})
    if preview.get("composer") or not preview.get("panel") or "RHW MOBILE UI TEST" not in preview.get("text", ""):
        raise RuntimeError(f"Mobile forum preview lens failed: {result}")
    if not bbcode.get("panel") or not bbcode.get("output") or "RHW MOBILE UI TEST" not in bbcode.get("value", "") or "Mobile composer and forum BBCode remain synchronized." not in bbcode.get("value", ""):
        raise RuntimeError(f"Mobile BBCode lens synchronization failed: {result}")
    if result.get("activeView") != "write":
        raise RuntimeError(f"Mobile forum view state failed: {result}")
    print("V4.0.2 + PR2 smoke passed: thumb dock + WRITE / PREVIEW / BB CODE synchronization")


def test_pr3_comms_workflow(cdp, workspace, node):
    if workspace != "comms":
        return
    cdp.call("Emulation.setDeviceMetricsOverride", {
        "width": 390, "height": 820, "deviceScaleFactor": 1, "mobile": True,
    })
    try:
        time.sleep(.08)
        if node == "forum":
            result = base.ev(cdp, """(()=>{
              const fire=input=>input.dispatchEvent(new Event('input',{bubbles:true}));
              const visible=element=>{const style=getComputedStyle(element),rect=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0};
              commsRecipient.value='Bretonia Admiralty';fire(commsRecipient);
              commsSubject.value='Dockyard readiness confirmation';fire(commsSubject);
              commsMessage.value='## Production readiness\\n**Heavy Works** reports full output.\\n!WARNING Restricted gantry access.\\n!STATUS All lines operational.\\n- Hull plating ready';fire(commsMessage);
              commsDraftName.value='PR3 COMMS workflow smoke';fire(commsDraftName);
              const readiness=commsWorkflowStatus.textContent.replace(/\\s+/g,' ').trim();
              document.querySelector('[data-comms-surface="preview"]').click();
              const preview={
                active:document.body.dataset.commsMobileView,
                heading:document.querySelector('.forum-preview-body h3')?.textContent||'',
                warning:document.querySelector('.forum-preview-callout.warning')?.textContent||'',
                status:document.querySelector('.forum-preview-callout.status')?.textContent||'',
                bullets:document.querySelectorAll('.forum-preview-bullet').length
              };
              document.querySelector('.preview-panel [data-comms-surface="bbcode"]').click();
              const code=forumBbcodeOutput.value;
              const bbcode={
                active:document.body.dataset.commsMobileView,
                heading:code.includes('Production readiness'),
                bold:code.includes('[b]Heavy Works[/b]'),
                warning:code.includes('[color=#c98b2c][b]WARNING //[/b] Restricted gantry access.[/color]'),
                status:code.includes('[color=#78ad8a][b]STATUS //[/b] All lines operational.[/color]'),
                bullet:code.includes('[b]•[/b] Hull plating ready'),
                recipient:code.includes('Bretonia Admiralty'),
                subject:code.includes('Dockyard readiness confirmation')
              };
              const copy=document.querySelector('[data-copy-forum-bbcode]');
              RHWV4.mobileUi.setForumView('write');
              saveDraftBtn.click();
              document.querySelector('[data-comms-node="drafts"]').click();
              const card=[...document.querySelectorAll('.comms-draft-card')].find(item=>item.textContent.includes('PR3 COMMS workflow smoke'));
              const load=card?.querySelector('[data-load-draft]');
              const draft={
                count:Number(commsDraftCount.textContent),
                found:Boolean(card),
                loadHeight:load?.getBoundingClientRect().height||0,
                latest:commsDraftLatest.textContent
              };
              load?.click();
              draft.restored=commsSubject.value==='Dockyard readiness confirmation'&&commsRecipient.value==='Bretonia Admiralty';
              const touch=[...document.querySelectorAll('.comms-mobile-view-switch button,.comms-surface-actions button,.comms-actions button')]
                .filter(visible).map(element=>element.getBoundingClientRect().height);
              return{readiness,preview,bbcode,draft,touch,hash:location.hash,overflow:document.documentElement.scrollWidth-window.innerWidth};
            })()""")
            if "4 / 4 READY" not in result.get("readiness", "") or result.get("preview", {}).get("active") != "preview" or result.get("preview", {}).get("heading") != "Production readiness" or result.get("preview", {}).get("bullets") != 1:
                raise RuntimeError(f"PR3 COMMS write/preview workflow failed: {result}")
            if not all(result.get("bbcode", {}).values()) or result.get("bbcode", {}).get("active") != "bbcode":
                raise RuntimeError(f"PR3 COMMS preview/BBCode parity failed: {result}")
            draft = result.get("draft", {})
            if draft.get("count", 0) < 1 or not draft.get("found") or draft.get("loadHeight", 0) < 43.5 or draft.get("latest") == "—" or not draft.get("restored") or result.get("hash") != "#comms/forum":
                raise RuntimeError(f"PR3 COMMS named draft resume failed: {result}")
            if result.get("overflow", 0) > 2 or any(height < 43.5 for height in result.get("touch", [])):
                raise RuntimeError(f"PR3 COMMS mobile touch/overflow failed: {result}")
            print("PR3 smoke passed: COMMS readiness → preview → BBCode + named draft resume")
        elif node == "drafts":
            result = base.ev(cdp, "({summary:!!document.querySelector('.comms-archive-summary'),count:!!document.getElementById('commsDraftCount'),latest:!!document.getElementById('commsDraftLatest')})")
            if not all(result.values()):
                raise RuntimeError(f"PR3 COMMS draft archive summary failed: {result}")
        elif node == "senders":
            result = base.ev(cdp, """(()=>{
              const active=document.querySelector('.sender-registry-card.active');
              const create=document.getElementById('v40CreateSenderBtn');
              create?.click();
              const editor=document.getElementById('v40SenderEditor');
              const controls=[...editor.querySelectorAll('button,input')].filter(element=>{const r=element.getBoundingClientRect();return r.width>0&&r.height>0}).map(element=>element.getBoundingClientRect().height);
              const editorVisible=!editor.hidden;
              v40SenderEditorCancel.click();
              return{active:!!active,badge:active?.querySelector('.sender-registry-head span')?.textContent||'',disabled:active?.querySelector('[data-use-sender]')?.disabled||false,createHeight:create?.getBoundingClientRect().height||0,editor:editorVisible,controls};
            })()""")
            if not result.get("active") or result.get("badge") != "ACTIVE PROFILE" or not result.get("disabled") or result.get("createHeight", 0) < 43.5 or not result.get("editor") or any(height < 43.5 for height in result.get("controls", [])):
                raise RuntimeError(f"PR3 COMMS sender registry/editor failed: {result}")
            print("PR3 smoke passed: active sender registry + touch-ready local editor")
        elif node == "ticker":
            result = base.ev(cdp, """(()=>{
              const app=RHWV4;
              const visible=element=>{const style=getComputedStyle(element),rect=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0};
              app.newswireManager.applyLoadedSource('# RHW Industrial Newswire\\n\\n## operations\\n- [BASE | good] BASE MESSAGE\\n\\n## security\\n- [WATCH | warn] WATCH MESSAGE\\n','repository');
              v40NewswireNewBtn.click();
              v40TickerCategory.value='operations';v40TickerCategory.dispatchEvent(new Event('change',{bubbles:true}));
              v40TickerTone.value='good';v40TickerTone.dispatchEvent(new Event('change',{bubbles:true}));
              v40TickerTag.value='RHW QA';v40TickerTag.dispatchEvent(new Event('input',{bubbles:true}));
              v40TickerMessage.value='MOBILE COMMS WORKFLOW READY';v40TickerMessage.dispatchEvent(new Event('input',{bubbles:true}));
              const editor={tag:v40TickerTagCount.textContent,message:v40TickerMessageCount.textContent,preview:v40TickerPreviewText.textContent,block:v40TickerOutput.value,step:document.querySelector('[data-newswire-jump="editor"]')?.getAttribute('aria-current')};
              v40NewswireSaveBtn.click();
              RHWV4.newswireOrdering.setFilter('operations',{scroll:false});
              const reset=[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='RESET TO CURRENT FILE');
              const controls=[...document.querySelectorAll('#v40NewswireWorkflow button,#v40NewswireManager button,#v40NewswireFilePanel button,#v40NewswireFilePanel summary')]
                .filter(visible).map(element=>({name:element.textContent.trim().replace(/\\s+/g,' '),height:element.getBoundingClientRect().height}));
              const result={
                editor,workflow:document.querySelectorAll('[data-newswire-jump]').length,
                activeStep:document.querySelector('[data-newswire-jump][aria-current="step"]')?.dataset.newswireJump||'',
                entries:app.newswireManager.state.entries.length,dirty:app.newswireManager.state.dirty,
                draft:Boolean(app.newswireManager.draftPayload()),status:v40NewswireManagerStatus.textContent,
                recovery:v40NewswireRecoveryState.textContent,source:v40NewswireFileOutput.value,
                filter:document.querySelector('[data-newswire-filter].active')?.dataset.newswireFilter||'',
                visibleRows:[...document.querySelectorAll('.v40-newswire-entry')].filter(row=>!row.hidden).length,
                resetDisabled:reset?.disabled,controls,
                overflow:document.documentElement.scrollWidth-window.innerWidth
              };
              app.newswireManager.resetWorkingCopy({announce:false});
              return result;
            })()""")
            editor = result.get("editor", {})
            if editor.get("preview") != "MOBILE COMMS WORKFLOW READY" or "RHW QA" not in editor.get("block", "") or editor.get("tag") != "6 / 40" or editor.get("message") != "27 / 240" or editor.get("step") != "step":
                raise RuntimeError(f"PR3 COMMS ticker mobile workflow failed: {result}")
            if result.get("workflow") != 3 or result.get("activeStep") != "list" or result.get("entries") != 3 or not result.get("dirty") or result.get("filter") != "operations" or result.get("visibleRows") != 2:
                raise RuntimeError(f"PR3 Newswire workflow/filter/recovery state failed: {result}")
            if "- [RHW QA | good] MOBILE COMMS WORKFLOW READY" not in result.get("source", "") or "LOCAL EDITS" not in result.get("status", "") or not result.get("recovery", "").startswith("SAVED ") or result.get("resetDisabled"):
                raise RuntimeError(f"PR3 Newswire output/local draft state failed: {result}")
            if result.get("overflow", 0) > 2 or any(item.get("height", 0) < 43.5 for item in result.get("controls", [])):
                raise RuntimeError(f"PR3 Newswire mobile touch/overflow failed: {result}")
            print("PR3 smoke passed: Newswire bulletins → editor → working copy + durable local recovery")
    finally:
        cdp.call("Emulation.clearDeviceMetricsOverride")


def test_backup_and_storage(cdp):
    result = base.ev(cdp, """(()=>{
      const app=RHWV4,k=app.config.storageKeys;
      const original={
        get:app.store.get.bind(app.store),
        set:app.store.set.bind(app.store),
        remove:app.store.remove.bind(app.store)
      };
      const memory=new Map();
      const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
      app.store.get=(key,fallback=null)=>memory.has(key)?clone(memory.get(key)):fallback;
      app.store.set=(key,value)=>{memory.set(key,clone(value));return true};
      app.store.remove=key=>{memory.delete(key);return true};
      try{
        app.newswireManager.applyLoadedSource('# RHW Industrial Newswire\\n\\n## operations\\n- [BASE | good] BASE MESSAGE\\n','repository');
        app.newswireManager.applyAdd({category:'security',tone:'warn',tag:'RECOVERY TEST',message:'DURABLE LOCAL DRAFT'});
        app.store.set(k.calculatorPriceProfiles,[{id:'pr1-profile',name:'PR1 Market',prices:{steel:1234},updatedAt:42}]);
        app.store.set(k.shipyardPlanner,{target:'dunkirk',quantity:3});
        app.store.set(k.activeWorkspace,'comms');
        app.store.set(k.commsMobileView,'preview');
        const payload=app.storage.exportPayload();
        memory.clear();
        const imported=app.storage.importPayload(payload);
        const restoredDraft=app.store.get(k.newswireManagerDraft,null);
        const legacy={format:'rhw-webapp-local-cache',version:1,current:payload.current,drafts:[],localSenders:[]};
        const legacyResult=app.storage.importPayload(legacy);
        app.newswireManager.applyLoadedSource('# RHW Industrial Newswire\\n\\n## operations\\n- [BASE | good] REPOSITORY SOURCE CHANGED\\n','repository');
        app.reportStorageFailure('Smoke test','pr1-smoke',new Error('EXPECTED'));
        const warning={shown:document.documentElement.dataset.rhwStorageError==='true',button:!!document.querySelector('#rhwStorageWarning button')};
        app.clearStorageWarning();
        return{
          version:payload.version,
          profile:app.store.get(k.calculatorPriceProfiles,[])[0]?.name||'',
          planner:app.store.get(k.shipyardPlanner,null),
          draft:restoredDraft?.entries?.some(entry=>entry.tag==='RECOVERY TEST')||false,
          changed:app.newswireManager.state.draftSourceChanged,
          mobileView:app.store.get(k.commsMobileView,''),
          imported,legacy:legacyResult,warning
        };
      }catch(error){
        return{error:String(error?.stack||error)};
      }finally{
        try{app.newswireManager.resetWorkingCopy({announce:false});app.clearStorageWarning()}catch{}
        app.store.get=original.get;
        app.store.set=original.set;
        app.store.remove=original.remove;
      }
    })()""")
    if result.get("error") or result.get("version") != 2 or result.get("profile") != "PR1 Market" or result.get("planner", {}).get("quantity") != 3 or not result.get("draft") or not result.get("changed") or result.get("mobileView") != "preview" or not all(result.get("warning", {}).values()) or "legacy" not in result:
        raise RuntimeError(f"V2 local backup / storage warning failed: {result}")
    print("V4.0.2 + PR2 smoke passed: V2 backup, V1 import, durable Newswire draft, storage warning")

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



def test_pr3_decision_ui(cdp, workspace, node):
    if (workspace, node) == ("command", "shipyard"):
        result = base.ev(cdp, """(()=>{
          window.hasVerifiedTelemetry=()=>true;
          window.stockFor=()=>50000;
          if(typeof renderShipyardControl==='function')renderShipyardControl();
          RHWV4.qol.ensureShipyardPlanner();
          const strip=document.querySelector('.shipyard-decision-strip');
          const grid=document.querySelector('#shipyardControl .shipyard-control-grid');
          const planner=document.getElementById('shipyardBuildPlanner');
          return{
            metrics:strip?.querySelectorAll('.shipyard-decision-metric').length||0,
            labels:[...(strip?.querySelectorAll('small')||[])].map(x=>x.textContent.trim()),
            mobileLabels:[...document.querySelectorAll('.shipyard-component-required,.shipyard-component-stock,.shipyard-component-coverage')].every(x=>Boolean(x.dataset.label)),
            plannerOrder:Boolean(grid&&planner&&grid.nextElementSibling===planner)
          };
        })()""")
        if result.get("metrics") != 3 or result.get("labels") != ["BUILDABLE NOW", "BOTTLENECK", "MISSING FOR NEXT HULL"] or not result.get("mobileLabels") or not result.get("plannerOrder"):
            raise RuntimeError(f"PR3 Shipyard decision UI failed: {result}")
        print("PR3 smoke passed: Shipyard readiness strip + planner below stock")
    elif (workspace, node) == ("command", "production"):
        cdp.call("Emulation.setDeviceMetricsOverride", {
            "width": 390, "height": 820, "deviceScaleFactor": 1, "mobile": True,
        })
        try:
            result = base.ev(cdp, """(()=>{
              window.hasVerifiedTelemetry=()=>true;
              renderProductionModules();
              const tools=document.getElementById('productionModuleTools');
              const grid=document.getElementById('productionGrid');
              const visible=element=>{const style=getComputedStyle(element),rect=element.getBoundingClientRect();return !element.hidden&&style.display!=='none'&&rect.width>0&&rect.height>0};
              const all=tools?.querySelector('[data-production-filter="all"]');
              const blocked=tools?.querySelector('[data-production-filter="critical"]');
              const search=tools?.querySelector('#productionModuleSearch');
              if(!tools||!grid||!all||!blocked||!search)return{error:'production decision controls missing'};
              search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));
              const total=grid.querySelectorAll('.production-card').length;
              blocked.click();
              const blockedStates=[...grid.querySelectorAll('.production-card')].filter(card=>!card.hidden).map(card=>card.dataset.productionState);
              all.click();
              search.value='Gold';search.dispatchEvent(new Event('input',{bubbles:true}));
              const searchProducts=[...grid.querySelectorAll('.production-card')].filter(card=>!card.hidden).map(card=>card.dataset.productionProduct);
              search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));
              const card=grid.querySelector('.production-card'),toggle=card?.querySelector('.production-card-toggle'),list=card?.querySelector('.recipe-list');
              const before={collapsed:card?.classList.contains('production-card-collapsed'),display:list?getComputedStyle(list).display:''};
              toggle?.click();
              const after={expanded:card?.classList.contains('production-card-expanded'),display:list?getComputedStyle(list).display:'',aria:toggle?.getAttribute('aria-expanded')};
              const touch=[...tools.querySelectorAll('button,input'),...grid.querySelectorAll('.production-card-toggle')].filter(visible).map(x=>x.getBoundingClientRect().height);
              return{
                total,filters:tools.querySelectorAll('[data-production-filter]').length,
                blockedStates,searchProducts,before,after,touch,
                overflow:document.documentElement.scrollWidth-window.innerWidth
              };
            })()""")
        finally:
            cdp.call("Emulation.clearDeviceMetricsOverride")
        if result.get("error") or result.get("total", 0) <= 0 or result.get("filters") != 4 or any(state != "critical" for state in result.get("blockedStates", [])):
            raise RuntimeError(f"PR3 Production filters failed: {result}")
        if not result.get("searchProducts") or any("gold" not in product for product in result.get("searchProducts", [])):
            raise RuntimeError(f"PR3 Production search failed: {result}")
        if not result.get("before", {}).get("collapsed") or result.get("before", {}).get("display") != "none" or not result.get("after", {}).get("expanded") or result.get("after", {}).get("display") == "none" or result.get("after", {}).get("aria") != "true":
            raise RuntimeError(f"PR3 Production card details failed: {result}")
        if result.get("overflow", 0) > 2 or any(height < 43.5 for height in result.get("touch", [])):
            raise RuntimeError(f"PR3 Production mobile layout failed: {result}")
        print("PR3 smoke passed: Production filters + search + independent mobile details")



def test_pr3_calculator_ui(cdp, workspace, node):
    if (workspace, node) != ("operations", "calculator"):
        return
    for width in MOBILE_WIDTHS:
        cdp.call("Emulation.setDeviceMetricsOverride", {
            "width": width, "height": 820, "deviceScaleFactor": 1, "mobile": True,
        })
        try:
            result = base.ev(cdp, """(()=>{
              RHWV4.operations.renderCalculator();
              RHWV4.qol.ensureProfilePanel();
              const root=document.documentElement;
              const rows=[...document.querySelectorAll('.ops-material-row')];
              const prices=[...document.querySelectorAll('[data-material-price]')];
              prices.forEach((input,index)=>{
                input.value=String((index+1)*111);
                input.dispatchEvent(new Event('input',{bubbles:true}));
              });
              const visible=element=>{
                const style=getComputedStyle(element),rect=element.getBoundingClientRect();
                return style.display!=='none'&&rect.width>0&&rect.height>0;
              };
              const touch=[
                ...document.querySelectorAll('[data-ops-quantity],.ops-mobile-jumps button,.ops-mobile-quote-jump,.ops-profile-actions button,.ops-price-input')
              ].filter(visible).map(element=>element.getBoundingClientRect().height);
              const first=rows[0];
              const materialWrap=document.querySelector('.ops-material-table-wrap');
              const decision=document.querySelector('.ops-mobile-decision');
              const profile=document.getElementById('opsPriceProfiles');
              const costPanel=document.querySelector('.ops-cost-panel');
              const coverage=document.getElementById('opsPriceCoverage')?.textContent.trim()||'';
              const sell=document.getElementById('opsSellUnit')?.textContent.trim()||'';
              const mirror=document.getElementById('opsMobileSellUnit')?.textContent.trim()||'';
              return{
                recipes:document.querySelectorAll('#opsRecipe option').length,
                rows:rows.length,
                rowDisplay:first?getComputedStyle(first).display:'',
                wrapOverflow:materialWrap?getComputedStyle(materialWrap).overflowX:'',
                decisionDisplay:decision?getComputedStyle(decision).display:'',
                profileOrder:profile?getComputedStyle(profile).order:'',
                profileInCost:Boolean(profile&&costPanel&&costPanel.contains(profile)),
                touch,coverage,sell,mirror,
                jumpTargets:[...document.querySelectorAll('[data-ops-jump]')].every(button=>Boolean(document.getElementById(button.dataset.opsJump))),
                overflow:root.scrollWidth-window.innerWidth
              };
            })()""")
        finally:
            cdp.call("Emulation.clearDeviceMetricsOverride")
        if result.get("recipes") != 287 or result.get("rows", 0) <= 0:
            raise RuntimeError(f"PR3 Calculator catalog/material rows failed at {width}px: {result}")
        if result.get("rowDisplay") != "grid" or result.get("wrapOverflow") != "visible" or result.get("decisionDisplay") != "grid":
            raise RuntimeError(f"PR3 Calculator mobile hierarchy failed at {width}px: {result}")
        if result.get("profileOrder") != "2" or not result.get("profileInCost") or not result.get("jumpTargets"):
            raise RuntimeError(f"PR3 Calculator mobile workflow failed at {width}px: {result}")
        if result.get("overflow", 0) > 2 or any(height < 43.5 for height in result.get("touch", [])):
            raise RuntimeError(f"PR3 Calculator overflow/touch target failed at {width}px: {result}")
        if not result.get("coverage", "").startswith(f'{result["rows"]} / {result["rows"]}') or result.get("sell") in ("", "—") or result.get("sell") != result.get("mirror"):
            raise RuntimeError(f"PR3 Calculator live quote mirror failed at {width}px: {result}")

    cdp.call("Emulation.setDeviceMetricsOverride", {
        "width": 768, "height": 900, "deviceScaleFactor": 1, "mobile": False,
    })
    try:
        tablet = base.ev(cdp, """(()=>{
          RHWV4.operations.renderCalculator();
          const root=document.documentElement,row=document.querySelector('.ops-material-row');
          return{overflow:root.scrollWidth-window.innerWidth,rowDisplay:row?getComputedStyle(row).display:''};
        })()""")
    finally:
        cdp.call("Emulation.clearDeviceMetricsOverride")
    if tablet.get("overflow", 0) > 2 or tablet.get("rowDisplay") != "table-row":
        raise RuntimeError(f"PR3 Calculator tablet layout failed: {tablet}")
    print("PR3 smoke passed: Calculator mobile cards + touch controls + live quote + tablet table")


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


def test_pr4_pwa(cdp, workspace, node):
    if (workspace, node) != ("command", "overview"):
        return
    cdp.call("Emulation.setDeviceMetricsOverride", {
        "width": 390, "height": 820, "deviceScaleFactor": 1, "mobile": True,
    })
    try:
        result = base.ev(cdp, """(()=>{
          RHWPWA.showManualInstructions();
          Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});
          RHWPWA.syncConnectionState();
          const install=document.getElementById('rhwPwaInstallBtn');
          const panel=document.getElementById('rhwPwaPanel');
          const primary=document.getElementById('rhwPwaPrimary');
          const offline=document.getElementById('rhwPwaOffline');
          const snapshot={
            api:!!window.RHWPWA, install:!!install, installHeight:install?.getBoundingClientRect().height||0,
            inAppHeader:!!document.querySelector('.app-nav-brand #rhwPwaInstallBtn'),
            inTelemetry:!!document.querySelector('.uplink-actions #rhwPwaInstallBtn'),
            ios:RHWPWA.manualInstructions('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)','iPhone',5),
            panelVisible:!panel?.hidden, primaryHeight:primary?.getBoundingClientRect().height||0,
            message:document.getElementById('rhwPwaMessage')?.textContent||'',
            network:document.documentElement.dataset.rhwNetwork,
            offlineVisible:!offline?.hidden,
            headerDisabled:!!document.getElementById('headerRefreshBtn')?.disabled,
            tableDisabled:!!document.getElementById('refreshBtn')?.disabled,
            overflow:document.documentElement.scrollWidth-window.innerWidth
          };
          delete navigator.onLine;
          RHWPWA.syncConnectionState();
          document.getElementById('rhwPwaClose')?.click();
          return snapshot;
        })()""")
    finally:
        cdp.call("Emulation.clearDeviceMetricsOverride")
    if (not result.get("api") or not result.get("install") or result.get("installHeight", 0) < 43.5
            or not result.get("inAppHeader") or result.get("inTelemetry")
            or "SAFARI" not in result.get("ios", {}).get("message", "")
            or "IPHONE / IPAD" not in result.get("ios", {}).get("title", "")
            or not result.get("panelVisible") or result.get("primaryHeight", 0) < 47.5
            or "HOME SCREEN" not in result.get("message", "") or result.get("network") != "offline"
            or not result.get("offlineVisible") or not result.get("headerDisabled")
            or not result.get("tableDisabled") or result.get("overflow", 0) > 2):
        raise RuntimeError(f"PR4 PWA mobile/install/offline state failed: {result}")
    print("PR4 smoke passed: app-header install controls + iOS guidance + honest offline state")


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
                test_pr3_decision_ui(cdp, workspace, node)
                test_pr3_calculator_ui(cdp, workspace, node)
                test_pr3_comms_workflow(cdp, workspace, node)
                test_pr4_pwa(cdp, workspace, node)
                if (workspace, node) == ("comms", "forum"):
                    test_mobile_forum_controls(cdp)
                run_interactions(cdp, workspace, node)
                test_mobile_layout(cdp, workspace, node)
                cdp.call("Runtime.evaluate", {"expression": "void 0"})
                runtime_failures = [
                    failure for failure in cdp.take_runtime_failures()
                    if not ("TypeError: Failed to fetch" in failure and "fetchWithTimeout" in failure)
                ]
                if runtime_failures:
                    raise RuntimeError(f"Browser console/runtime errors {workspace}/{node}: {runtime_failures}")
                print(f"V4.0.2 + PR2 smoke passed: {workspace}/{node} (287 recipes / 248 products; mobile 360/390/412/430)")
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
