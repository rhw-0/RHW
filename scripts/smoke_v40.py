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
    raise SystemExit("websocket-client is required for scripts/smoke_v40.py") from exc

ROOT = Path(__file__).resolve().parents[1]
ROUTES = [
    ("command", "overview"), ("command", "inventory"), ("command", "shipyard"),
    ("command", "production"), ("command", "logistics"), ("comms", "forum"),
    ("comms", "ticker"), ("comms", "drafts"), ("comms", "senders"),
]
V4_CSS = ["css/12-app-v40.css", "css/13-app-v40-navigation.css", "css/14-app-v40-composer.css", "css/15-app-v40-audit.css"]
V4_JS = ["js/12-app-config.js", "js/13-app-v40.js", "js/14-app-v40-cache.js", "js/15-app-v40-navigation.js", "js/16-app-v40-composer.js", "js/17-app-v40-audit.js"]


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
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
    raise RuntimeError(f"Timed out waiting for {url}: {last}")


class CDP:
    def __init__(self, url: str) -> None:
        self.ws = websocket.create_connection(url, timeout=7)
        self.next_id = 1

    def call(self, method: str, params: dict | None = None) -> dict:
        call_id = self.next_id
        self.next_id += 1
        self.ws.send(json.dumps({"id": call_id, "method": method, "params": params or {}}))
        deadline = time.time() + 10
        while time.time() < deadline:
            message = json.loads(self.ws.recv())
            if message.get("id") == call_id:
                if "error" in message:
                    raise RuntimeError(f"CDP {method} failed: {message['error']}")
                return message.get("result", {})
        raise RuntimeError(f"CDP {method} timed out")

    def close(self) -> None:
        self.ws.close()


def script_safe(text: str) -> str:
    return text.replace("</script", "<\\/script")


def build_inline_document(route: str) -> str:
    source = (ROOT / "index.html").read_text(encoding="utf-8")

    # External fonts are irrelevant to functional smoke checks and can delay a headless run.
    source = re.sub(r"\s*<link[^>]+href=\"https://[^>]+>\s*", "\n", source, flags=re.I)

    def css_repl(match: re.Match[str]) -> str:
        href = match.group(1)
        path = ROOT / href.removeprefix("./")
        if not path.is_file():
            return match.group(0)
        return f"<style data-smoke-source=\"{html.escape(href)}\">\n{path.read_text(encoding='utf-8')}\n</style>"

    source = re.sub(r"<link\s+rel=\"stylesheet\"\s+href=\"(\./css/[^\"]+)\"\s*>", css_repl, source, flags=re.I)

    def js_repl(match: re.Match[str]) -> str:
        src = match.group(1)
        path = ROOT / src.removeprefix("./")
        if not path.is_file():
            return match.group(0)
        return f"<script data-smoke-source=\"{html.escape(src)}\">\n{script_safe(path.read_text(encoding='utf-8'))}\n</script>"

    source = re.sub(r"<script\s+src=\"(\./js/[^\"]+)\"\s*></script>", js_repl, source, flags=re.I)

    v4_styles = "\n".join(f"<style data-smoke-v4=\"{path}\">{(ROOT / path).read_text(encoding='utf-8')}</style>" for path in V4_CSS)
    source = source.replace("</head>", f"{v4_styles}\n<script>window.__RHW_SMOKE_INLINE__=true;history.replaceState(null,'','#{route}');</script>\n</head>")
    v4_scripts = "\n".join(f"<script data-smoke-v4=\"{path}\">{script_safe((ROOT / path).read_text(encoding='utf-8'))}</script>" for path in V4_JS)
    source = source.replace("</body>", f"{v4_scripts}\n</body>")
    return source


def evaluate_snapshot(cdp: CDP) -> dict:
    result = cdp.call("Runtime.evaluate", {
        "expression": "JSON.stringify({ready:document.documentElement.dataset.v40Ready||'',error:document.documentElement.dataset.v40Error||'',workspace:document.body?.dataset.workspace||'',commandNode:document.body?.dataset.commandNode||'',commsNode:document.body?.dataset.commsNode||'',smoke:window.__RHW_V4_SMOKE__||null})",
        "returnByValue": True,
    })
    raw = result.get("result", {}).get("value")
    return json.loads(raw) if raw else {}


def main() -> int:
    browser = next((shutil.which(name) for name in ("google-chrome-stable", "google-chrome", "chromium", "chromium-browser") if shutil.which(name)), None)
    if not browser:
        print("ERROR: Chrome/Chromium not found", file=sys.stderr)
        return 1

    debug_port = free_port()
    user_dir = tempfile.mkdtemp(prefix="rhw-v40-chrome-")
    chrome_log = tempfile.TemporaryFile()
    chrome = subprocess.Popen([
        browser, "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-background-networking",
        "--disable-component-update", "--disable-default-apps", "--disable-sync", "--no-first-run",
        f"--remote-debugging-port={debug_port}", "--remote-allow-origins=*", f"--user-data-dir={user_dir}", "about:blank",
    ], stdout=chrome_log, stderr=chrome_log)

    try:
        wait_url(f"http://127.0.0.1:{debug_port}/json/version")
        targets = json.loads(wait_url(f"http://127.0.0.1:{debug_port}/json/list"))
        page = next(target for target in targets if target.get("type") == "page")
        cdp = CDP(page["webSocketDebuggerUrl"])
        try:
            cdp.call("Page.enable")
            cdp.call("Runtime.enable")
            cdp.call("Network.enable")
            cdp.call("Network.setBlockedURLs", {"urls": ["https://*", "http://*"]})

            for workspace, node in ROUTES:
                cdp.call("Page.navigate", {"url": "about:blank"})
                cdp.call("Page.setDocumentContent", {"frameId": page["id"], "html": build_inline_document(f"{workspace}/{node}")})
                deadline = time.time() + 6
                snapshot: dict = {}
                while time.time() < deadline:
                    snapshot = evaluate_snapshot(cdp)
                    if snapshot.get("ready") in {"true", "false"}:
                        break
                    time.sleep(0.1)
                if snapshot.get("ready") != "true" or snapshot.get("error") == "true":
                    raise RuntimeError(f"V4 not ready on {workspace}/{node}: {snapshot}")
                if snapshot.get("workspace") != workspace:
                    raise RuntimeError(f"Workspace mismatch on {workspace}/{node}: {snapshot}")
                active = snapshot.get("commandNode") if workspace == "command" else snapshot.get("commsNode")
                if active != node:
                    raise RuntimeError(f"Node mismatch on {workspace}/{node}: {snapshot}")
                if (snapshot.get("smoke") or {}).get("errors"):
                    raise RuntimeError(f"Runtime self-test errors on {workspace}/{node}: {snapshot['smoke']['errors']}")
                print(f"V4 runtime smoke passed: {workspace}/{node}")
        finally:
            cdp.close()
    finally:
        chrome.terminate()
        try:
            chrome.wait(timeout=3)
        except subprocess.TimeoutExpired:
            chrome.kill()
        shutil.rmtree(user_dir, ignore_errors=True)
        chrome_log.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
