#!/usr/bin/env python3
"""Focused browser smoke for final V4 recipe labels, costing semantics and header clock layout."""
from __future__ import annotations

import json
import re
import shutil
import time

import smoke_v40 as base

ORDERING = "js/16c-app-v40-newswire-ordering.js"
CORRECTION = "js/18c-app-v40-recipe-corrections.js"
POLISH = "js/18d-app-v40-final-ui-polish.js"

if ORDERING not in base.V4_JS:
    base.V4_JS.insert(base.V4_JS.index("js/16b-app-v40-newswire-manager.js") + 1, ORDERING)
if CORRECTION not in base.V4_JS:
    base.V4_JS.insert(base.V4_JS.index("js/18b-app-v40-production-pricing.js") + 1, CORRECTION)
if POLISH not in base.V4_JS:
    base.V4_JS.insert(base.V4_JS.index(CORRECTION) + 1, POLISH)


def number_from_money(value: str) -> int:
    digits = re.sub(r"[^0-9]", "", value or "")
    return int(digits) if digits else 0


def main() -> int:
    chrome, browser, port, folder, _log = base.launch()
    print(f"V4 final-polish smoke browser: {browser}")
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
            snap = {}
            while time.time() < end:
                snap = base.snapshot(cdp)
                if snap.get("ready") in {"true", "false"}:
                    break
                time.sleep(.1)
            if snap.get("ready") != "true" or snap.get("error") == "true" or snap.get("errors"):
                raise RuntimeError(f"Final polish route boot failed: {snap}")
            if snap.get("recipes") != 287 or snap.get("products") != 248:
                raise RuntimeError(f"Corrected catalog missing in final polish route: {snap}")

            labels = base.ev(cdp, """(()=>({
              duplicates:RHWV4.finalUiPolish?.duplicateFinalLabels?.()||[['missing-polish',['missing']]],
              self:RHWV4.finalUiPolish?.selfTest?.()||['missing-polish'],
              gold:['recipe_gold_basic','recipe_gold_advanced','recipe_gold_bulk','recipe_gold_wildcat_conversion'].map(id=>RHWV4.finalUiPolish.recipeLabel(RHWV4.operationsCore.recipe(id))),
              diamonds:['recipe_diamonds_basic','recipe_diamonds_advanced','recipe_diamonds_bulk'].map(id=>RHWV4.finalUiPolish.recipeLabel(RHWV4.operationsCore.recipe(id))),
              header:[...document.querySelector('.uplink-grid').children].filter(x=>x.classList.contains('uplink-stat')).map(x=>x.querySelector('small')?.textContent?.trim()||'')
            }))()""")
            if labels.get("duplicates") or labels.get("self"):
                raise RuntimeError(f"Duplicate/final label self-test failed: {labels}")
            if len(set(labels.get("gold", []))) != 4 or not any("Gold Refining · Basic" in x for x in labels.get("gold", [])) or not any("Wildcat Gold Reprocessing" in x for x in labels.get("gold", [])):
                raise RuntimeError(f"Gold recipe labels are not distinct/meaningful: {labels}")
            if len(set(labels.get("diamonds", []))) != 3:
                raise RuntimeError(f"Diamond recipe labels are not distinct: {labels}")
            if labels.get("header", [])[:4] != ["SYSTEM CLOCK", "LATEST SYNC", "NEXT SYNC", "REFRESH CYCLE"]:
                raise RuntimeError(f"Header clock order is wrong: {labels.get('header')}")

            base.ev(cdp, """(()=>{
              opsRecipeSearch.value='recipe_gold_basic';
              opsRecipeSearch.dispatchEvent(new Event('input',{bubbles:true}));
              return{};
            })()""")
            time.sleep(.45)
            option_data = base.ev(cdp, """(()=>({
              recipe:opsRecipe?.value||'',
              labels:[...opsRecipe.options].filter(o=>o.value.startsWith('recipe_gold_')).map(o=>[o.value,o.textContent])
            }))()""")
            if option_data.get("recipe") != "recipe_gold_basic" or len({text for _, text in option_data.get("labels", [])}) != len(option_data.get("labels", [])):
                raise RuntimeError(f"Rendered Gold dropdown labels are not unique: {option_data}")

            base.ev(cdp, """(()=>{
              document.querySelectorAll('[data-material-price]').forEach(input=>{
                input.value='100';input.dispatchEvent(new Event('input',{bubbles:true}));
              });
              opsMargin.value='20';opsMargin.dispatchEvent(new Event('input',{bubbles:true}));
              return{};
            })()""")
            time.sleep(.15)
            costing = base.ev(cdp, """(()=>({
              card:document.querySelector('.ops-flow-cost')?.textContent||'',
              margin:document.querySelector('.ops-flow-margin')?.textContent||'',
              sellCard:document.querySelector('.ops-flow-sell')?.textContent||'',
              flowMeta:document.querySelector('.ops-quote-panel .ops-panel-head>small')?.textContent||'',
              batch:opsTotalCost?.textContent||'',unit:opsUnitCost?.textContent||'',sell:opsSellUnit?.textContent||'',
              actual:[...document.querySelectorAll('.ops-recipe-meta>div')].find(x=>x.querySelector('small')?.textContent==='ACTUAL OUTPUT')?.querySelector('strong')?.textContent||'0'
            }))()""")
            batch = number_from_money(costing.get("batch", ""))
            unit = number_from_money(costing.get("unit", ""))
            sell = number_from_money(costing.get("sell", ""))
            actual = int(re.sub(r"[^0-9]", "", costing.get("actual", "")) or "0")
            if "TOTAL BATCH COST" not in costing.get("card", "") or "MANUFACTURING COST / UNIT" not in costing.get("card", ""):
                raise RuntimeError(f"Batch/unit costing labels missing: {costing}")
            if "COST / UNIT" not in costing.get("margin", "") or "SALE PRICE / UNIT" not in costing.get("sellCard", "") or "UNIT COST" not in costing.get("flowMeta", ""):
                raise RuntimeError(f"Per-unit quote flow is not explicit: {costing}")
            if actual <= 1 or batch <= unit or unit <= 0 or sell <= unit:
                raise RuntimeError(f"Batch/unit costing semantics failed: {costing}")

            print("V4 interaction smoke passed: unique recipe labels + unit-first costing + top-left header clock")
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