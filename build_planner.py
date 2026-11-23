"""Build a preloaded offline planner or a launcher for the hosted app."""

import argparse
import base64
import gzip
import hashlib
import html
import json
from pathlib import Path
from urllib.parse import urlsplit


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
    packed = base64.urlsafe_b64encode(gzip.compress(roster.encode("utf-8"), mtime=0)).decode("ascii").rstrip("=")
    url = html.escape(base_url + "#p=" + packed, quote=True)
    return f'''<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><title>2027 Primary · Leader link</title>
<style>html{{background:#f1f5ec;color:#264638;font:1rem/1.5 system-ui}}main{{max-width:32rem;margin:12vh auto;padding:24px;background:white;border:1px solid #cbd7c6;border-radius:14px}}h1{{font:2.2rem Georgia,serif;margin:.2em 0}}small{{font-weight:600}}a,button{{display:inline-block;border:1px solid #45664e;border-radius:7px;padding:10px 14px;margin:4px 3px 4px 0;font:inherit;text-decoration:none;cursor:pointer;color:#264638;background:#f4f7f0}}a{{background:#285443;color:white}}textarea{{width:100%;box-sizing:border-box}}</style>
<main><small>Spring Creek Fourth Ward · 2027</small><h1>Primary leader link</h1>
<p>Give this link to the leaders planning classes. It opens with the starting roster. Each browser saves its own assignments.</p>
<a id="leader" href="{url}">Open planner</a><button id="copy">Copy leader link</button>
<p id="status" role="status"></p><textarea id="manual" hidden readonly aria-label="Preloaded leader link"></textarea></main>
<script>document.getElementById("copy").onclick=async()=>{{
const url=document.getElementById("leader").href,status=document.getElementById("status");
try{{await navigator.clipboard.writeText(url);status.textContent="Leader link copied.";}}
catch{{const field=document.getElementById("manual");field.hidden=false;field.value=url;field.focus();field.select();status.textContent="Copy the selected link.";}}
}};</script></html>'''


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
