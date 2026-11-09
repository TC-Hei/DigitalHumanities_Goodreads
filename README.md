# Readers vs Judges — website

A static website: plain HTML, CSS and JavaScript. No server, database or build step.

```
index.html      page structure (9 sections, switched with #links)
style.css       design
app.js          search, game and charts (uses d3)
lib/d3.min.js   d3 v7 charting library, bundled so the site works offline
data/data.js    all numbers and 7,730 book records, exported by scripts/03_analysis.py
```

## View it on your own computer
Double-click `index.html`. Everything works offline except the world-map outline (it downloads
from cdn.jsdelivr.net) and the web fonts, which fall back to system fonts.

## Host it free on GitHub Pages
1. Create a public repository on GitHub, e.g. `readers-vs-judges`.
2. Upload the *contents* of this `site` folder (index.html must be at the top level).
3. Repository → Settings → Pages → Source: "Deploy from a branch" → Branch: `main`, folder `/ (root)` → Save.
4. After a minute the site is live at `https://<your-username>.github.io/readers-vs-judges/`.

Netlify Drop (app.netlify.com/drop) also works: drag the `site` folder onto the page.

## Update the data
Re-run the pipeline from the project root; `03_analysis.py` rewrites `site/data/data.js`:

```
python scripts/01_scrape_prizes.py
python scripts/02_clean.py
python scripts/03_analysis.py
```

Data licence: the Goodreads dataset is CC BY-NC 4.0 (non-commercial use, credit the authors) — keep the footer credit.
