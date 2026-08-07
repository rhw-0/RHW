#!/usr/bin/env python3
"""Runtime smoke test for RHW V4 using Chrome DevTools and an inline site bundle."""
from __future__ import annotations

import html
import json
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

try:
    import websocket
except ImportError as exc:
    raise SystemExit('websocket-client is required for scripts/smoke_v40.py') from exc

ROOT = Path(__file__).resolve().parents[1]
ROUTES = [
    ('command', 'overview'), ('command', 'inventory'), ('command', 'shipyard'),
    ('command', 'production'), ('command', 'logistics'), ('operations', 'calculator'),
    ('comms', 'forum'), ('comms', 'ticker'), ('comms', 'drafts'), ('comms', 'senders'),
]
V4_CSS = [
    'css/12-app-v40.css', 'css/13-app-v40-navigation.css', 'css/14-app-v40-composer.css',
    'css/15-app-v40-audit.css', 'css/16-app-v40-operations.css',
]
V4_JS = [
    'js/12-app-config.js', 'js/13-app-v40.js', 'js/14-app-v40-cache.js', 'js/15-app-v40-navigation.js',
    'js/16-app-v40-composer.js',
    'assets/recipes/catalog-v1-part-01.js', 'assets/recipes/catalog-v1-part-02.js', 'assets/recipes/catalog-v1-part-03.js',
    'assets/recipes/catalog-v1-part-04.js', 'assets/recipes/catalog-v1-part-05.js', 'assets/recipes/catalog-v1-part-06.js',
    'js/17-app-v40-operations-core.js', 'js/18-app-v40-operations-ui.js', 'js/19-app-v40-runtime.js',
]


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return int(sock.getsockname()[1])


def wait_url(url: str, timeout: float = 8.0) -> bytes:
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                return response.read()
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(0.12)
    raise RuntimeError(f'Timed out waiting for {url}: {last}')


class CDP:
    def __init__(self, url: str) -> None:
        self.ws = websocket.create_connection(url, timeout=7)
        self.next_id = 1

    def call(self, method: str, params: dict | None = None) -> dict:
        call_id = self.next_id
        self.next_id += 1
        self.ws.send(json.dumps({'id': call_id, 'method': method, 'params': params or {}}))
        deadline = time.time() + 10
        while time.time() < deadline:
            message = json.loads(self.ws.recv())
            if message.get('id') == call_id:
                if 'error' in message:
                    raise RuntimeError(f"CDP {method} failed: {message['error']}")
                return message.get('result', {})
        raise RuntimeError(f'CDP {method} timed out')

    def close(self) -> None:
        self.ws.close()


def script_safe(text: str) -> str:
    return text.replace('</script', '<\\/script')


def build_inline_document(route: str) -> str:
    source = (ROOT / 'index.html').read_text(encoding='utf-8')
    source = re.sub(r'\s*<link[^>]+href="https://[^>]+>\s*', '\n', source, flags=re.I)

    def css_repl(match: re.Match[str]) -> str:
        href = match.group(1)
        path = ROOT / href.removeprefix('./')
        if not path.is_file():
            return match.group(0)
        return f'<style data-smoke-source="{html.escape(href)}">\n{path.read_text(encoding="utf-8")}\n</style>'

    source = re.sub(r'<link\s+rel="stylesheet"\s+href="(\./css/[^"]+)"\s*>', css_repl, source, flags=re.I)

    def js_repl(match: re.Match[str]) -> str:
        src = match.group(1)
        path = ROOT / src.removeprefix('./')
        if not path.is_file():
            return match.group(0)
        return f'<script data-smoke-source="{html.escape(src)}">\n{script_safe(path.read_text(encoding="utf-8"))}\n</script>'

    source = re.sub(r'<script\s+src="(\./js/[^"]+)"\s*></script>', js_repl, source, flags=re.I)
    v4_styles = '\n'.join(
        f'<style data-smoke-v4="{path}">{(ROOT / path).read_text(encoding="utf-8")}</style>' for path in V4_CSS
    )
    source = source.replace(
        '</head>',
        f"{v4_styles}\n<script>window.__RHW_SMOKE_INLINE__=true;history.replaceState(null,'','#{route}');</script>\n</head>",
    )
    v4_scripts = '\n'.join(
        f'<script data-smoke-v4="{path}">{script_safe((ROOT / path).read_text(encoding="utf-8"))}</script>' for path in V4_JS
    )
    return source.replace('</body>', f'{v4_scripts}\n</body>')


def evaluate_json(cdp: CDP, expression: str) -> dict:
    result = cdp.call('Runtime.evaluate', {
        'expression': f'JSON.stringify({expression})',
        'returnByValue': True,
        'awaitPromise': True,
    })
    raw = result.get('result', {}).get('value')
    return json.loads(raw) if raw else {}


def evaluate_snapshot(cdp: CDP) -> dict:
    return evaluate_json(cdp, "({ready:document.documentElement.dataset.v40Ready||'',error:document.documentElement.dataset.v40Error||'',workspace:document.body?.dataset.workspace||'',commandNode:document.body?.dataset.commandNode||'',operationsNode:document.body?.dataset.operationsNode||'',commsNode:document.body?.dataset.commsNode||'',recipeCount:window.RHWV4?.operationsCore?.state?.catalog?.meta?.recipeCount||0,smoke:window.__RHW_V4_SMOKE__||null})")


def verify_operations_costing(cdp: CDP) -> None:
    trigger = evaluate_json(cdp, "(() => { const search=document.getElementById('opsRecipeSearch'); if(!search) return {ok:false,reason:'missing-search'}; search.value='Superstr'; search.dispatchEvent(new Event('input',{bubbles:true})); return {ok:true}; })()")
    if not trigger.get('ok'):
        raise RuntimeError(f'Operations costing search unavailable: {trigger}')
    time.sleep(0.35)
    selected = evaluate_json(cdp, "({recipe:document.getElementById('opsRecipe')?.selectedOptions?.[0]?.textContent||'',target:document.querySelector('.ops-selected-target strong')?.textContent||'',materialInputs:document.querySelectorAll('[data-material-price]').length,hasVariant:[...document.querySelectorAll('span')].some(el=>el.textContent.trim()==='RECIPE VARIANT')})")
    if 'superstructure' not in selected.get('recipe', '').lower() or 'superstructure' not in selected.get('target', '').lower():
        raise RuntimeError(f'Superstructure recipe search selected wrong recipe: {selected}')
    if 'dunkirk' in selected.get('recipe', '').lower() or selected.get('hasVariant'):
        raise RuntimeError(f'Obsolete/mismatched recipe variant surfaced: {selected}')
    if selected.get('materialInputs', 0) <= 0:
        raise RuntimeError(f'No material-price inputs rendered for Superstructure Systems: {selected}')

    evaluate_json(cdp, "(() => { document.querySelectorAll('[data-material-price]').forEach(input=>{input.value='1000';input.dispatchEvent(new Event('input',{bubbles:true}));}); const margin=document.getElementById('opsMargin'); if(margin){margin.value='20';margin.dispatchEvent(new Event('input',{bubbles:true}));} return {ok:true}; })()")
    quote = evaluate_json(cdp, "({coverage:document.getElementById('opsPriceCoverage')?.textContent||'',sell:document.getElementById('opsSellUnit')?.textContent||'',profit:document.getElementById('opsProfit')?.textContent||''})")
    if '—' in quote.get('sell', '') or 'CR' not in quote.get('sell', '') or 'CR' not in quote.get('profit', ''):
        raise RuntimeError(f'Cost/margin quote did not resolve after pricing materials: {quote}')
    print('V4 interaction smoke passed: operations recipe search + material pricing + margin')


def launch_browser() -> tuple[subprocess.Popen, str, int, str, str]:
    candidates: list[str] = []
    for name in ('google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'):
        path = shutil.which(name)
        if path and path not in candidates:
            candidates.append(path)
    if not candidates:
        raise RuntimeError('Chrome/Chromium not found')

    attempts = []
    for browser in candidates:
        for headless in ('--headless=new', '--headless'):
            debug_port = free_port()
            user_dir = tempfile.mkdtemp(prefix='rhw-v40-chrome-')
            log_path = str(Path(user_dir) / 'chrome.log')
            log_file = open(log_path, 'w+b')
            args = [
                browser, headless, '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
                '--disable-software-rasterizer', '--disable-background-networking', '--disable-component-update',
                '--disable-default-apps', '--disable-sync', '--no-first-run', '--no-zygote',
                f'--remote-debugging-port={debug_port}', '--remote-allow-origins=*',
                f'--user-data-dir={user_dir}', 'about:blank',
            ]
            chrome = subprocess.Popen(args, stdout=log_file, stderr=log_file)
            url = f'http://127.0.0.1:{debug_port}/json/version'
            deadline = time.time() + 5
            while time.time() < deadline:
                if chrome.poll() is not None:
                    break
                try:
                    wait_url(url, timeout=0.35)
                    log_file.close()
                    return chrome, browser, debug_port, user_dir, log_path
                except Exception:
                    time.sleep(0.12)
            try:
                chrome.terminate(); chrome.wait(timeout=1)
            except Exception:
                chrome.kill()
            log_file.flush(); log_file.seek(0)
            log = log_file.read().decode('utf-8', errors='replace')[-4000:]
            log_file.close()
            attempts.append(f'{browser} {headless} exit={chrome.poll()}\n{log}')
            shutil.rmtree(user_dir, ignore_errors=True)
    raise RuntimeError('Unable to launch a CDP-capable browser. Attempts:\n\n' + '\n\n---\n\n'.join(attempts))


def main() -> int:
    try:
        chrome, browser, debug_port, user_dir, log_path = launch_browser()
    except Exception as exc:
        print(f'ERROR: {exc}', file=sys.stderr)
        return 1

    print(f'V4 smoke browser: {browser}')
    try:
        wait_url(f'http://127.0.0.1:{debug_port}/json/version', timeout=3)
        targets = json.loads(wait_url(f'http://127.0.0.1:{debug_port}/json/list', timeout=3))
        page = next(target for target in targets if target.get('type') == 'page')
        cdp = CDP(page['webSocketDebuggerUrl'])
        try:
            cdp.call('Page.enable'); cdp.call('Runtime.enable'); cdp.call('Network.enable')
            cdp.call('Network.setBlockedURLs', {'urls': ['https://*', 'http://*']})

            for workspace, node in ROUTES:
                cdp.call('Page.navigate', {'url': 'about:blank'})
                cdp.call('Page.setDocumentContent', {'frameId': page['id'], 'html': build_inline_document(f'{workspace}/{node}')})
                deadline = time.time() + 8
                snapshot: dict = {}
                while time.time() < deadline:
                    snapshot = evaluate_snapshot(cdp)
                    if snapshot.get('ready') in {'true', 'false'}:
                        break
                    time.sleep(0.1)
                if snapshot.get('ready') != 'true' or snapshot.get('error') == 'true':
                    raise RuntimeError(f'V4 not ready on {workspace}/{node}: {snapshot}')
                if snapshot.get('workspace') != workspace:
                    raise RuntimeError(f'Workspace mismatch on {workspace}/{node}: {snapshot}')
                active_key = {'command': 'commandNode', 'operations': 'operationsNode', 'comms': 'commsNode'}[workspace]
                if snapshot.get(active_key) != node:
                    raise RuntimeError(f'Node mismatch on {workspace}/{node}: {snapshot}')
                if workspace == 'operations' and snapshot.get('recipeCount') != 289:
                    raise RuntimeError(f'Recipe catalog missing on {workspace}/{node}: {snapshot}')
                if (snapshot.get('smoke') or {}).get('errors'):
                    raise RuntimeError(f"Runtime self-test errors on {workspace}/{node}: {snapshot['smoke']['errors']}")
                print(f'V4 runtime smoke passed: {workspace}/{node}')
                if workspace == 'operations':
                    verify_operations_costing(cdp)
        finally:
            cdp.close()
    finally:
        chrome.terminate()
        try:
            chrome.wait(timeout=3)
        except subprocess.TimeoutExpired:
            chrome.kill()
        if chrome.poll() not in (0, None):
            try:
                log = Path(log_path).read_text(encoding='utf-8', errors='replace')[-2000:]
                if log.strip():
                    print(f'Chrome log tail:\n{log}', file=sys.stderr)
            except Exception:
                pass
        shutil.rmtree(user_dir, ignore_errors=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
