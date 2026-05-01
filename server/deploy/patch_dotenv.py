#!/usr/bin/env python3
"""Set or replace KEY=value in .env (single line, no shell quoting issues)."""
from __future__ import annotations

import pathlib
import re
import sys


def main() -> None:
    if len(sys.argv) != 3:
        print("usage: patch_dotenv.py KEY VALUE", file=sys.stderr)
        sys.exit(2)
    key, val = sys.argv[1], sys.argv[2]
    path = pathlib.Path(".env")
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    pat = re.compile(rf"^{re.escape(key)}=.*$", re.MULTILINE)
    line = f"{key}={val}\n"
    if pat.search(text):
        text = pat.sub(line.rstrip("\n"), text, count=1)
    else:
        if text and not text.endswith("\n"):
            text += "\n"
        text += line
    path.write_text(text, encoding="utf-8")
    print(f"[patch_dotenv] wrote {key}=… ({len(val)} chars)")


if __name__ == "__main__":
    main()
