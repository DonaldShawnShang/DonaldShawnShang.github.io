# donaldshawnshang.github.io

Personal academic homepage of **Wentao (Donald) Shang (尚文韬)** — live at <https://donaldshawnshang.github.io/>.

Plain static HTML/CSS in the AcadHomepage style (no build step, no external CDNs, loads fast in mainland China).

```
index.html                 English page  (/)
zh/index.html              Chinese page  (/zh/)
assets/css/style.css       styles; colour tokens for light / dark at the top
assets/js/main.js          theme toggle, BibTeX toggle/copy, nav highlight
assets/img/icons.svg       icon sprite (Font Awesome Free 6.6.0, CC BY 4.0)
assets/img/                avatar, favicon, paper overview figures
assets/cv/                 public CV (PDF)
assets/fonts/              self-hosted Plus Jakarta Sans (SIL OFL)
```

- **Two languages, two pages**: keep `index.html` and `zh/index.html` in sync when editing content. Asset paths are root-absolute (`/assets/...`) so both pages share them.
- **Theme**: follows the system light/dark setting; the moon/sun button overrides it (remembered per browser).
- **Adding a paper**: copy an `<article class="paper-box">` block in `#publications` on both pages; put a ~960px-wide figure in `assets/img/`.

Preview locally with `python3 -m http.server` from the repo root, then commit and push to `main`.

## Checks

`scripts/check_site.py` runs on every push (GitHub Actions, `.github/workflows/site-check.yml`) and every Monday:

- internal links, images and icon references exist; in-page anchors exist; HTML tags are balanced; JSON-LD parses
- nothing published (pages, llms.txt, CV PDF) leaks under-review papers, a phone number, or other details the owner keeps off the site
- the prompt-injection demo text never appears as plain text (only base64 inside `demo.js`)
- English and Chinese pages have the same sections, item counts and external links
- `llms.txt` matches the homepage (email, ORCID, DOI, paper titles) and its site links exist
- `sitemap.xml`, `robots.txt` and `.well-known/security.txt` (fails when expired, warns 60 days ahead)
- JavaScript parses; weekly: external links (lychee)

Run locally before pushing: `python3 scripts/check_site.py`

