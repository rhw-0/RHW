#!/usr/bin/env python3
"""RHW Focus Pass smoke: daily navigation stays simple; secondary tools stay reachable."""
from __future__ import annotations

import json
import time

import smoke_v40 as harness
import smoke_v40_base as base
import smoke_v402  # noqa: F401  # installs the production CSS/JS matrix

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
                "html": base.document("command/inventory"),
            })

            end = time.time() + 9
            snap = {}
            while time.time() < end:
                snap = base.snapshot(cdp)
                if snap.get("ready") in {"true", "false"}:
                    break
                time.sleep(.1)
            if snap.get("ready") != "true" or snap.get("errors"):
                raise RuntimeError(f"Focus Pass route did not boot: {snap}")

            time.sleep(.35)
            result = base.ev(cdp, """(()=>{
              const visible=element=>{
                if(!element)return false;
                const style=getComputedStyle(element),rect=element.getBoundingClientRect();
                return style.display!=='none'&&style.visibility!=='hidden'&&style.opacity!=='0'&&rect.width>0&&rect.height>0;
              };
              const title=workspace=>{
                const button=document.querySelector(`.app-tabs [data-workspace="${workspace}"]`);
                const spans=[...(button?.children||[])].filter(x=>x.tagName==='SPAN'&&!x.classList.contains('rhw-workspace-index'));
                return (spans[0]||button?.querySelector('span'))?.textContent?.trim()||'';
              };
              const api=RHWV4.focusPass;
              const initial={
                api:!!api,failures:api?.selfTest?.()||[],
                labels:[title('command'),title('operations'),title('comms')],
                toolButton:visible(document.getElementById('rhwFocusToolsBtn')),
                diagnosticsVisible:visible(document.getElementById('rhwDiagnosticsBtn')),
                overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth
              };

              document.querySelector('.app-tabs [data-workspace="operations"]')?.click();
              const calculator={
                workspace:document.body.dataset.workspace,node:document.body.dataset.operationsNode,
                subnav:visible(document.getElementById('operationsNodeNav')),
                calculator:visible(document.querySelector('[data-operations-panel="calculator"]')),
                orders:visible(document.querySelector('[data-operations-panel="orders"]')),
                dataStatus:visible(document.getElementById('rhwDataStatusUtility')),
                active:document.getElementById('appActiveNode')?.textContent||''
              };

              api.openTools();
              const tools={
                open:visible(document.getElementById('rhwFocusToolsPanel')),
                count:document.querySelectorAll('#rhwFocusToolsPanel [data-rhw-tool]').length,
                buttonExpanded:document.getElementById('rhwFocusToolsBtn')?.getAttribute('aria-expanded')||''
              };
              api.openTool('build-queue');
              const queue={
                workspace:document.body.dataset.workspace,node:document.body.dataset.operationsNode,
                tool:document.body.dataset.rhwFocusTool||'',
                orders:visible(document.querySelector('[data-operations-panel="orders"]')),
                active:document.getElementById('appActiveNode')?.textContent||''
              };

              document.querySelector('.app-tabs [data-workspace="operations"]')?.click();
              const calculatorReturn={workspace:document.body.dataset.workspace,node:document.body.dataset.operationsNode,tool:document.body.dataset.rhwFocusTool||''};

              api.openTool('data');
              const data={
                workspace:document.body.dataset.workspace,node:document.body.dataset.operationsNode,
                tool:document.body.dataset.rhwFocusTool||'',
                utility:visible(document.getElementById('rhwDataStatusUtility')),
                open:document.getElementById('rhwDataStatusUtility')?.open===true
              };

              document.querySelector('.app-tabs [data-workspace="comms"]')?.click();
              const forum={
                workspace:document.body.dataset.workspace,node:document.body.dataset.commsNode,
                subnav:visible(document.getElementById('commsNodeNav')),
                panel:visible(document.querySelector('[data-comms-panel="forum"]')),
                tool:document.body.dataset.rhwFocusTool||'',
                active:document.getElementById('appActiveNode')?.textContent||''
              };

              api.openTool('newswire');
              const newswire={workspace:document.body.dataset.workspace,node:document.body.dataset.commsNode,tool:document.body.dataset.rhwFocusTool||'',panel:visible(document.querySelector('[data-comms-panel="ticker"]'))};
              document.querySelector('.app-tabs [data-workspace="comms"]')?.click();
              const forumReturn={workspace:document.body.dataset.workspace,node:document.body.dataset.commsNode,tool:document.body.dataset.rhwFocusTool||''};

              api.openTool('system');
              const system={panel:visible(document.getElementById('rhwDiagnosticsPanel'))};
              RHWV4.diagnostics?.close?.();

              return{initial,calculator,tools,queue,calculatorReturn,data,forum,newswire,forumReturn,system,
                overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth};
            })()""")

            initial = result.get("initial", {})
            if not initial.get("api") or initial.get("failures") or initial.get("labels") != ["COMMAND", "CALCULATOR", "FORUM"]:
                raise RuntimeError(f"Focused primary navigation failed: {result}")
            if not initial.get("toolButton") or initial.get("diagnosticsVisible") or initial.get("overflow", 0) > 2:
                raise RuntimeError(f"Focused header/tools state failed: {result}")

            calc = result.get("calculator", {})
            if calc.get("workspace") != "operations" or calc.get("node") != "calculator" or calc.get("subnav") or not calc.get("calculator") or calc.get("orders") or calc.get("dataStatus") or "CALCULATOR" not in calc.get("active", ""):
                raise RuntimeError(f"Calculator is not a clean daily destination: {result}")

            tools = result.get("tools", {})
            if not tools.get("open") or tools.get("count") != 6 or tools.get("buttonExpanded") != "true":
                raise RuntimeError(f"TOOLS surface failed: {result}")

            queue = result.get("queue", {})
            if queue.get("workspace") != "operations" or queue.get("node") != "orders" or queue.get("tool") != "build-queue" or not queue.get("orders") or "TOOLS / BUILD QUEUE" not in queue.get("active", ""):
                raise RuntimeError(f"Build Queue tool routing failed: {result}")
            if result.get("calculatorReturn") != {"workspace": "operations", "node": "calculator", "tool": ""}:
                raise RuntimeError(f"Calculator primary tab did not reset secondary route: {result}")

            data = result.get("data", {})
            if data != {"workspace": "operations", "node": "calculator", "tool": "data", "utility": True, "open": True}:
                raise RuntimeError(f"Data Status tool failed: {result}")

            forum = result.get("forum", {})
            if forum.get("workspace") != "comms" or forum.get("node") != "forum" or forum.get("subnav") or not forum.get("panel") or forum.get("tool") or "FORUM" not in forum.get("active", ""):
                raise RuntimeError(f"Forum is not a clean daily destination: {result}")
            newswire = result.get("newswire", {})
            if newswire != {"workspace": "comms", "node": "ticker", "tool": "newswire", "panel": True}:
                raise RuntimeError(f"Newswire tool routing failed: {result}")
            if result.get("forumReturn") != {"workspace": "comms", "node": "forum", "tool": ""}:
                raise RuntimeError(f"Forum primary tab did not reset secondary route: {result}")
            if not result.get("system", {}).get("panel"):
                raise RuntimeError(f"System Check tool routing failed: {result}")
            if result.get("overflow", 0) > 2:
                raise RuntimeError(f"Focus Pass mobile horizontal overflow: {result}")

            runtime_failures = [
                failure for failure in cdp.take_runtime_failures()
                if not ("TypeError: Failed to fetch" in failure and "fetchWithTimeout" in failure)
            ]
            if runtime_failures:
                raise RuntimeError(f"Browser console/runtime errors: {runtime_failures}")

            print("RHW Focus Pass smoke passed: COMMAND / CALCULATOR / FORUM stay primary while secondary tools remain reachable")
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
