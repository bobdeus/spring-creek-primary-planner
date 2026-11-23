# Spring Creek Fourth Ward Primary

A browser-local classroom planner for 2027. The iPhone layout pairs a tappable adult list with one selected classroom. The desktop board supports drag and drop. Every assignment can also be made with a keyboard.

## Open a preloaded planner

The private starting roster is in `private/roster.json`. Generate a portable HTML file with Python 3.9 or newer.

```powershell
python build_planner.py "$env:USERPROFILE/Primary Planner 2027/Open Classroom Planner.html"
```

Open that file in a browser. All artwork, code, and starting names are included. Rebuild to the same location to keep using the browser’s existing assignments. Each file location, browser profile, and hosted site can have its own local copy. Browser storage survives reloads. Clearing it removes local edits.

## Static hosting

Publish **only the contents of `docs/`**. For GitHub Pages, choose the `main` branch and the `/docs` folder. The static site has no external scripts, analytics, or roster files.

To generate a local launcher for a deployed site, pass its HTTPS base address using `--site`. The launcher carries the starting roster as ordinary text in a URL fragment. The browser reads it, saves local state, and removes the fragment from the address bar. An existing saved plan takes precedence.

## Hand off the finished plan

Choose **Export plan → Download JSON** for a versioned file with every class, named children and adults, room assignments, and unassigned entries. **Share or email file** uses the system file-sharing dialog when available. The fallback downloads the JSON and offers an email draft. Attach the downloaded file before sending.
