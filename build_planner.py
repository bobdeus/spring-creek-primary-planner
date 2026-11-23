"""Build a preloaded offline planner or a launcher for the hosted app."""

import argparse
import base64
import hashlib
import html
import json
from pathlib import Path
from urllib.parse import quote, urlsplit


ROOT = Path(__file__).resolve().parent
SITE = ROOT / "docs"


def source_hash(text):
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    return "'sha256-" + base64.b64encode(digest).decode("ascii") + "'"


def offline_page(roster):
    page = (SITE / "index.html").read_text(encoding="utf-8")
    script = (SITE / "planner.js").read_text(encoding="utf-8")
    styles = (SITE / "planner.css").read_text(encoding="utf-8")
    picture = base64.b64encode((SITE / "spring-creek.webp").read_bytes()).decode("ascii")
    styles = styles.replace("spring-creek.webp", "data:image/webp;base64," + picture)
    data = roster.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    page = page.replace("script-src 'self'", f"script-src {source_hash(script)} {source_hash(data)}")
    page = page.replace("style-src 'self'", "style-src " + source_hash(styles))
    page = page.replace('<link rel="stylesheet" href="planner.css">', f"<style>{styles}</style>")
    page = page.replace('<script src="planner.js" defer></script>', "")
    return page.replace("</body>", f'<script id="starting-roster" type="application/json">{data}</script>\n<script>{script}</script>\n</body>')


def hosted_launcher(base_url, roster):
    target = urlsplit(base_url)
    if target.scheme != "https" or not target.hostname or target.query or target.fragment:
        raise ValueError("Supply the HTTPS base address for the hosted planner.")
    url = html.escape(base_url + "#roster=" + quote(roster, safe=""), quote=True)
    return f'''<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="referrer" content="no-referrer"><title>Open classroom planner</title>
<meta http-equiv="refresh" content="0;url={url}">
<a href="{url}">Open the 2027 classroom planner</a></html>'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="Local HTML file outside the repository")
    parser.add_argument("--site", help="Published site URL for a hosted launcher")
    args = parser.parse_args()
    output = args.output.resolve()
    if output.is_relative_to(ROOT) or output.suffix.lower() != ".html":
        parser.error("Choose an HTML file outside the source repository.")
    seed = json.loads((ROOT / "private" / "roster.json").read_text(encoding="utf-8"))
    roster = json.dumps(seed, ensure_ascii=False, separators=(",", ":"))
    page = hosted_launcher(args.site, roster) if args.site else offline_page(roster)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(page.encode("utf-8"))


if __name__ == "__main__":
    main()
