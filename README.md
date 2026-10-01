# donaldshawnshang.github.io

Personal academic homepage of **Wentao (Donald) Shang (尚文韬)** — live at <https://donaldshawnshang.github.io/>.

Plain static HTML/CSS in the AcadHomepage style (no build step, no external CDNs, loads fast in mainland China).

```
index.html                 page content (English + Chinese)
assets/css/style.css       styles; colour tokens for light / dark at the top
assets/img/                avatar, favicon, paper overview figures
assets/cv/                 public CV (PDF)
assets/fonts/              self-hosted Source Sans 3 (SIL OFL)
```

- **Bilingual**: every visible text has an English `<span class="en">` and a Chinese `<span class="zh">` twin; the 中文/EN button switches between them. Add both when editing.
- **Theme**: follows the system light/dark setting; the moon/sun button overrides it (remembered per browser).
- **Adding a paper**: copy a `<div class="paper-box">` block in `#publications`, put a ~960px-wide figure in `assets/img/`.

Icons: Font Awesome Free 6.6.0 (CC BY 4.0), inlined as an SVG sprite in `index.html`.

Preview locally with `python3 -m http.server`, then commit and push to `main`.
