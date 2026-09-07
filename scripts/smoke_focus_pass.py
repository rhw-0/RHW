#!/usr/bin/env python3
"""RHW Focus Pass smoke: daily navigation stays simple; secondary tools stay reachable."""
from __future__ import annotations

import json
import time

import smoke_v40 as harness
import smoke_v40_base as base
import smoke_v402  # noqa: F401  # installs the production CSS/JS matrix

harness._ensure_app_layer_assets()

VISIBLE_HELPER = """const visible=element=>{if(!element)return false;const style=getComputedStyle(element),rect=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&style.opacity!=='0'&&rect.width>0&&rect.height>0};"""


def settle(seconds: float = .12) -> None:
    """Wait one or more real render ticks after a user-like navigation action."""
    time.sleep(seconds)


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

            settle(.35)
            initial = base.ev(cdp, f"""(()=>{{
              {VISIBLE_HELPER}
              const title=workspace=>{{
                const button=document.querySelector(`.app-tabs [data-workspace="${{workspace}}"]`);
                const spans=[...(button?.children||[])].filter(x=>x.tagName==='SPAN'&&!x.classList.contains('rhw-workspace-index'));
                return (spans[0]||button?.querySelector('span'))?.textContent?.trim()||'';
              }};
              const api=RHWV4.focusPass;
              return{{
                api:!!api,failures:api?.selfTest?.()||[],
                labels:[title('command'),title('operations'),title('comms')],
                toolButton:visible(document.getElementById('rhwFocusToolsBtn')),
                diagnosticsVisible:visible(document.getElementById('rhwDiagnosticsBtn')),
                overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth
              }};
            }})()""")
            if not initial.get("api") or initial.get("failures") or initial.get("labels") != ["COMMAND", "CALCULATOR", "FORUM"]:
                raise RuntimeError(f"Focused primary navigation failed: {initial}")
            if not initial.get("toolButton") or initial.get("diagnosticsVisible") or initial.get("overflow", 0) > 2:
                raise RuntimeError(f"Focused header/tools state failed: {initial}")

            base.ev(cdp, "(()=>{document.querySelector('.app-tabs [data-workspace=\"operations\"]')?.click();return true;})()")
            settle()
            calculator = base.ev(cdp, f"""(()=>{{{VISIBLE_HELPER}return{{
              workspace:document.body.dataset.workspace,node:document.body.dataset.operationsNode,
              subnav:visible(document.getElementById('operationsNodeNav')),
              calculator:visible(document.querySelector('[data-operations-panel="calculator"]')),
              orders:visible(document.querySelector('[data-operations-panel="orders"]')),
              dataStatus:visible(document.getElementById('rhwDataStatusUtility')),
              active:document.getElementById('appActiveNode')?.textContent||''
            }};}})()""")
            if calculator.get("workspace") != "operations" or calculator.get("node") != "calculator" or calculator.get("subnav") or not calculator.get("calculator") or calculator.get("orders") or calculator.get("dataStatus") or "CALCULATOR" not in calculator.get("active", ""):
                raise RuntimeError(f"Calculator is not a clean daily destination: {calculator}")

            base.ev(cdp, "(()=>{RHWV4.focusPass.openTools();return true;})()")
            settle(.06)
            tools = base.ev(cdp, f"""(()=>{{
              {VISIBLE_HELPER}
              const panel=document.getElementById('rhwFocusToolsPanel');
              const focusable=[...panel.querySelectorAll('button')].filter(visible);
              const first=focusable[0],last=focusable[focusable.length-1];
              last?.focus();
              last?.dispatchEvent(new KeyboardEvent('keydown',{{key:'Tab',bubbles:true,cancelable:true}}));
              const wrapsForward=document.activeElement===first;
              first?.focus();
              first?.dispatchEvent(new KeyboardEvent('keydown',{{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}}));
              const wrapsBack=document.activeElement===last;
              return{{open:visible(panel),count:document.querySelectorAll('#rhwFocusToolsPanel [data-rhw-tool]').length,
                buttonExpanded:document.getElementById('rhwFocusToolsBtn')?.getAttribute('aria-expanded')||'',
                focusTrap:wrapsForward&&wrapsBack}};
            }})()""")
            if not tools.get("open") or tools.get("count") != 5 or tools.get("buttonExpanded") != "true" or not tools.get("focusTrap"):
                raise RuntimeError(f"TOOLS surface/focus trap failed: {tools}")

            base.ev(cdp, "(()=>{RHWV4.focusPass.openTool('build-queue');return true;})()")
            settle()
            queue = base.ev(cdp, f"""(()=>{{{VISIBLE_HELPER}return{{
              workspace:document.body.dataset.workspace,node:document.body.dataset.operationsNode,
              tool:document.body.dataset.rhwFocusTool||'',
              orders:visible(document.querySelector('[data-operations-panel="orders"]')),
              active:document.getElementById('appActiveNode')?.textContent||''
            }};}})()""")
            if queue.get("workspace") != "operations" or queue.get("node") != "orders" or queue.get("tool") != "build-queue" or not queue.get("orders") or "TOOLS / BUILD QUEUE" not in queue.get("active", ""):
                raise RuntimeError(f"Build Queue tool routing failed: {queue}")

            base.ev(cdp, "(()=>{document.querySelector('.app-tabs [data-workspace=\"operations\"]')?.click();return true;})()")
            settle()
            calculator_return = base.ev(cdp, "({workspace:document.body.dataset.workspace,node:document.body.dataset.operationsNode,tool:document.body.dataset.rhwFocusTool||''})")
            if calculator_return != {"workspace": "operations", "node": "calculator", "tool": ""}:
                raise RuntimeError(f"Calculator primary tab did not reset secondary route: {calculator_return}")

            base.ev(cdp, "(()=>{RHWV4.focusPass.openTool('data');return true;})()")
            settle(.18)
            data = base.ev(cdp, f"""(()=>{{{VISIBLE_HELPER}return{{
              workspace:document.body.dataset.workspace,node:document.body.dataset.operationsNode,
              tool:document.body.dataset.rhwFocusTool||'',utility:visible(document.getElementById('rhwDataStatusUtility')),
              open:document.getElementById('rhwDataStatusUtility')?.open===true,system:visible(document.getElementById('rhwDiagnosticsPanel'))
            }};}})()""")
            if data != {"workspace": "operations", "node": "calculator", "tool": "", "utility": True, "open": True, "system": True}:
                raise RuntimeError(f"Data Status tool failed: {data}")
            base.ev(cdp, "(()=>{RHWV4.diagnostics.close();return true;})()")

            base.ev(cdp, "(()=>{document.querySelector('.app-tabs [data-workspace=\"comms\"]')?.click();return true;})()")
            settle()
            forum = base.ev(cdp, f"""(()=>{{{VISIBLE_HELPER}return{{
              workspace:document.body.dataset.workspace,node:document.body.dataset.commsNode,
              subnav:visible(document.getElementById('commsNodeNav')),
              panel:visible(document.querySelector('[data-comms-panel="forum"]')),
              tool:document.body.dataset.rhwFocusTool||'',active:document.getElementById('appActiveNode')?.textContent||''
            }};}})()""")
            if forum.get("workspace") != "comms" or forum.get("node") != "forum" or forum.get("subnav") or not forum.get("panel") or forum.get("tool") or "FORUM" not in forum.get("active", ""):
                raise RuntimeError(f"Forum is not a clean daily destination: {forum}")

            base.ev(cdp, "(()=>{RHWV4.focusPass.openTool('newswire');return true;})()")
            settle()
            newswire = base.ev(cdp, f"""(()=>{{{VISIBLE_HELPER}return{{workspace:document.body.dataset.workspace,node:document.body.dataset.commsNode,
              tool:document.body.dataset.rhwFocusTool||'',panel:visible(document.querySelector('[data-comms-panel="ticker"]'))}};}})()""")
            if newswire != {"workspace": "comms", "node": "ticker", "tool": "newswire", "panel": True}:
                raise RuntimeError(f"Newswire tool routing failed: {newswire}")

            base.ev(cdp, "(()=>{document.querySelector('.app-tabs [data-workspace=\"comms\"]')?.click();return true;})()")
            settle()
            forum_return = base.ev(cdp, "({workspace:document.body.dataset.workspace,node:document.body.dataset.commsNode,tool:document.body.dataset.rhwFocusTool||''})")
            if forum_return != {"workspace": "comms", "node": "forum", "tool": ""}:
                raise RuntimeError(f"Forum primary tab did not reset secondary route: {forum_return}")

            base.ev(cdp, "(()=>{RHWV4.focusPass.openTool('system');return true;})()")
            settle(.06)
            system = base.ev(cdp, f"""(()=>{{{VISIBLE_HELPER}return{{panel:visible(document.getElementById('rhwDiagnosticsPanel'))}};}})()""")
            if not system.get("panel"):
                raise RuntimeError(f"System Check tool routing failed: {system}")
            base.ev(cdp, "(()=>{RHWV4.diagnostics?.close?.();return true;})()")

            # Native disclosures must actually hide controls, then reveal usable inputs.
            base.ev(cdp, "(()=>{RHWV4.navigate('operations','calculator');return true;})()")
            settle(.2)
            costing = base.ev(cdp, f"""(()=>{{{VISIBLE_HELPER}
              const profile=document.getElementById('opsPriceProfiles');
              const collapsed=!profile.open&&!visible(document.getElementById('opsPriceProfileName'));
              profile.querySelector('summary').click();
              const expanded=profile.open&&visible(document.getElementById('opsPriceProfileName'));
              const fields=[...document.querySelectorAll('[data-material-price]')];
              fields.forEach(field=>{{field.value='';field.dispatchEvent(new Event('input',{{bubbles:true}}));}});
              const button=document.getElementById('opsCompletePrices');
              button.click();
              const first=document.activeElement===fields[0];
              fields[0].value='0';fields[0].dispatchEvent(new Event('input',{{bubbles:true}}));
              button.click();
              const next=fields.length<2||document.activeElement===fields[1];
              fields.forEach(field=>{{field.value='1';field.dispatchEvent(new Event('input',{{bubbles:true}}));}});
              return{{collapsed,expanded,first,next,done:button.hidden,
                memory:document.querySelector('.ops-price-memory').textContent,
                duplicates:document.querySelectorAll('#opsPriceProfiles').length}};
            }})()""")
            if not all(costing.get(key) for key in ['collapsed','expanded','first','next','done']) or costing.get('duplicates') != 1 or 'Save a price profile' not in costing.get('memory',''):
                raise RuntimeError(f"Calculator disclosure or missing-price action failed: {costing}")

            base.ev(cdp, "(()=>{RHWV4.navigate('comms','forum');return true;})()")
            settle(.2)
            composer = base.ev(cdp, f"""(()=>{{{VISIBLE_HELPER}
              const advanced=document.querySelector('.comms-advanced');
              const message=document.getElementById('commsMessage');
              const location=document.getElementById('commsLocation');
              const encryption=document.getElementById('commsEncryption');
              const initial=visible(message)&&!visible(location)&&!visible(encryption);
              const before=RHWV4.comms.buildBbcode();
              advanced.querySelector('summary').click();
              const expanded=advanced.open&&visible(location)&&visible(encryption);
              const preserved=before===RHWV4.comms.buildBbcode();
              const more=document.querySelector('.comms-format-more');
              const blur=more.querySelector('[data-rhw-format="blur"]');
              const folded=!visible(blur);more.querySelector('summary').click();
              message.value='Format check';message.dispatchEvent(new Event('input',{{bubbles:true}}));
              message.setSelectionRange(0,message.value.length);blur.click();
              return{{initial,expanded,preserved,folded,formatted:message.value==='[sp2]Format check[/sp2]',
                metadataAfterMessage:!!(message.compareDocumentPosition(location)&Node.DOCUMENT_POSITION_FOLLOWING)}};
            }})()""")
            if not all(composer.values()):
                raise RuntimeError(f"Forum disclosure, metadata or formatting failed: {composer}")
            for destination in ['drafts', 'senders']:
                base.ev(cdp, f"(()=>{{document.querySelector('[data-forum-tool=\"{destination}\"]').click();return true;}})()")
                settle(.15)
                route = base.ev(cdp, "document.body.dataset.commsNode")
                if route != destination:
                    raise RuntimeError(f"Forum context link failed: {destination} -> {route}")
                base.ev(cdp, "(()=>{document.querySelector('.app-tabs [data-workspace=\"comms\"]').click();return true;})()")
                settle(.15)

            for width in [360, 390, 412, 430, 1366]:
                cdp.call("Emulation.setDeviceMetricsOverride", {"width":width,"height":900,"deviceScaleFactor":1,"mobile":width<760})
                geometry=base.ev(cdp, f"""(()=>{{{VISIBLE_HELPER}
                  const details=document.getElementById('uplinkDetails');details.open=false;
                  const collapsed=!visible(document.getElementById('headerClock'));
                  const headerHeight=document.querySelector('.command-header').getBoundingClientRect().height;
                  details.querySelector('summary').click();
                  const expanded=visible(document.getElementById('headerClock'));
                  const overflow=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth;
                  const refresh=document.getElementById('headerRefreshBtn').getBoundingClientRect().height;
                  details.querySelector('summary').click();
                  return{{collapsed,expanded,headerHeight,overflow,refresh}};
                }})()""")
                if not geometry['collapsed'] or not geometry['expanded'] or geometry['overflow']>2 or geometry['refresh']<44 or geometry['headerHeight']>(300 if width<760 else 220):
                    raise RuntimeError(f"Compact header at {width}px failed: {geometry}")

            overflow = base.ev(cdp, "Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth")
            if overflow > 2:
                raise RuntimeError(f"Focus Pass mobile horizontal overflow: {overflow}")

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
