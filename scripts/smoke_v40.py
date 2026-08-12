#!/usr/bin/env python3
"""Canonical RHW V4 smoke entry point.

Legacy interaction helpers remain in smoke_v40_base.py. The V4.0.2 production
runner composes those helpers with the exact deployed asset order and current
regression / quality-of-life coverage.
"""
from smoke_v40_base import *  # noqa: F401,F403


if __name__ == '__main__':
    from smoke_v402 import main
    raise SystemExit(main())
