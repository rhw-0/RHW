#!/usr/bin/env python3
"""Canonical RHW V4 smoke entry point.

Legacy interaction helpers remain in smoke_v40_base.py. The V4.0.2 production
runner composes those helpers with the exact deployed asset order and current
regression / quality-of-life coverage.
"""
import smoke_v40_base as _base
from smoke_v40_base import *  # noqa: F401,F403

COMMAND_REWORK_ASSET = "js/31-app-command-rework.js"


def _ensure_command_rework_asset() -> None:
    """Keep every smoke consumer aligned with the deployed command rework."""
    if COMMAND_REWORK_ASSET not in _base.V4_JS:
        runtime_index = _base.V4_JS.index("js/19-app-v40-runtime.js") if "js/19-app-v40-runtime.js" in _base.V4_JS else len(_base.V4_JS)
        _base.V4_JS.insert(runtime_index, COMMAND_REWORK_ASSET)
    globals()["V4_JS"] = _base.V4_JS


_ensure_command_rework_asset()


if __name__ == '__main__':
    from smoke_v402 import main
    # smoke_v402 composes its own production-order list during import.
    _ensure_command_rework_asset()
    raise SystemExit(main())
