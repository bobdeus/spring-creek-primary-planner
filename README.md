# Spring Creek Fourth Ward Primary

A browser-local classroom planner for 2027. The iPhone layout pairs a tappable adult list with one selected classroom. The desktop board supports drag and drop. Every assignment can also be made with a keyboard.

## Open a preloaded planner

The starting roster is in `private/roster.json`. Its visibility follows the GitHub repository’s visibility. Generate a portable HTML file with Python 3.9 or newer.

```powershell
python build_planner.py "$env:USERPROFILE/Primary Planner 2027/Open Classroom Planner.html"
```

Open that file in a browser. All artwork, code, and starting names are included. Rebuild to the same location to keep using the browser’s existing assignments. Each file location, browser profile, and hosted site can have its own local copy. Browser storage survives reloads. Clearing it removes local edits.

## Static hosting

Publish **only the contents of `docs/`**. For GitHub Pages, choose the `main` branch and the `/docs` folder. The static site has no external scripts, analytics, or roster files.

The ordinary URL opens a working planner with empty classes. To generate the leader link card, pass the site's HTTPS base address using `--site`. Its **Open planner** and **Copy leader link** buttons use a short key identifying the committed Git roster object. On first use, the browser retrieves that roster from GitHub. Subsequent visits reuse the saved ward plan. Each browser stores the ordinary planner and the ward planner separately. Previously shared links with an embedded roster still open the ward plan.

## Hand off the finished plan

Choose **Export plan → Download JSON** for a versioned file with every class, named children and adults, room assignments, and unassigned entries. **Share or email file** uses the system file-sharing dialog when available. The fallback downloads the JSON and offers an email draft. Attach the downloaded file before sending.
