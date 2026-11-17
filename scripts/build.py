#!/usr/bin/env python3
"""Bundle src/ into one self-contained HTML file: dist/index.html.

Inlines src/styles/*.css and every local <script src="js/..."> from src/index.html,
in order, into a single <script> so they share one scope exactly as in development.
External resources (Leaflet, Google Fonts) stay as CDN links.

    python3 scripts/build.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC, DIST = ROOT / "src", ROOT / "dist"
LOCAL = r'(?!https?:)'


def main() -> None:
    html = (SRC / "index.html").read_text(encoding="utf-8")

    html = re.sub(rf'<link rel="stylesheet" href="{LOCAL}([^"]+)">',
                  lambda m: "<style>\n" + (SRC / m.group(1)).read_text(encoding="utf-8") + "</style>", html)

    paths = re.findall(rf'<script src="{LOCAL}([^"]+)"></script>', html)
    bundle = "\n".join(f"/* --- {p} --- */\n" + (SRC / p).read_text(encoding="utf-8").replace("'use strict';\n", "", 1)
                       for p in paths)
    html = re.sub(r'<!-- App scripts share.*?-->\n', "", html)
    html = re.sub(rf'<script src="{LOCAL}[^"]+"></script>\n?', "", html)
    html = html.replace("</body>", f"<script>\n'use strict';\n{bundle}</script>\n</body>")

    DIST.mkdir(exist_ok=True)
    out = DIST / "index.html"
    out.write_text(html, encoding="utf-8")
    print(f"Wrote {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB, {len(paths)} scripts inlined)")


if __name__ == "__main__":
    main()
