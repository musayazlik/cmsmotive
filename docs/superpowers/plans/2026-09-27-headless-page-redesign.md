# Headless Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `static-site/headless.html` from a 3-section text-only page into a 6-section page with the same visual density and closing rhythm as `index.html`, with all content specific to headless TYPO3 work.

**Architecture:** `static-site/build.py` is the single source of truth for every page's markup; `headless.html` is generated output and must never be hand-edited. The redesign is one replacement of the `headless` template assignment in `build.py` plus one appended CSS block. All layout and code-panel styling reuses existing components (`.code`, `.code-head`, `.copy-btn`, `.file-tree`, `.proof-pills`, `.proof-panel.large`, `.compare-table`, `.callout`, `.article-card`); only a new `.hero-terminal` shell is added.

**Tech Stack:** Python 3 static site generator (`build.py`), plain CSS with custom properties, static HTML, Prettier 3.9.9 for formatting, no JS changes.

## Global Constraints

- `build.py` writes raw HTML; Prettier must run after every `build.py` invocation or the repo loses its formatting convention. Always run the pair.
- `headless.html` is generated output. Never edit it directly — all markup changes go in the `headless` template in `build.py`.
- The `headless` template is an **f-string**. Every literal `{` and `}` in JSON code samples must be doubled (`{{` / `}}`), otherwise Python raises `SyntaxError` at import time.
- **Appending rule for Tasks 2–6 (read carefully — this is the easiest step to get wrong):** each new section must go **inside** the `headless = f'''...'''` f-string, immediately before its closing `'''`. Inserting *after* the closing `'''` silently produces a file that still parses but renders a broken page, and was observed to do exactly that during plan validation.
  - To do this correctly in Python, locate the template boundaries and insert at `j - 3`, not `j`:

    ```python
    import pathlib
    p = pathlib.Path('build.py'); s = p.read_text()
    i = s.index("headless = f'''")        # start of the template assignment
    j = s.index("'''", i + 20) + 3        # just past its closing '''
    k = j - 3                             # the closing ''' itself
    s = s[:k] + '\n' + NEW_SECTION + s[k:]  # NEW_SECTION lands INSIDE the f-string
    p.write_text(s)
    ```

  - Do not use `s.rindex("'''")` — it finds the last triple-quote in the whole file, not the end of the `headless` template, and injects the section into an unrelated template further down.
  - Do not try to match and replace the template's current final line — its exact text changes after every preceding task.
- No released-product, package, version or price claims. Site-wide honesty convention. JSON samples may use real TYPO3 JSON:API *shape* but must carry a `.code-comment` marking them illustrative.
- All HTML is `lang="en"`. All new copy is English.
- No inline `style="..."` attributes anywhere — styling lives in `assets/css/site.css` only.
- No new image files. Reuse `assets/images/foundation-studio.webp`.
- Header/footer/nav markup is owned by `page()` in `build.py` and must not be duplicated inside the `headless` template.
- Every `.copy-btn` needs a `data-copy` attribute whose value matches the text shown in its `.code-head` sibling (consumed by `site.js:48`).

### Prettier-safe assertions

Prettier reindents HTML, so assertions must not depend on tag adjacency. **Never** assert on strings like `<thead><tr><th>`, `<tr><td>` or `width="1536" height="1024"` — Prettier splits all three across lines. Assert on individual tag names, attribute values, or text content instead. These forms are verified safe against the current Prettier-formatted output:

| Safe form | Do not use |
|---|---|
| `h.count('<section')` | — |
| `h.count('class="proof-panel"')` | `h.count('class="proof-panel')` — also matches `proof-panel-title` |
| `'class="proof-panel large"' in h` | — |
| `h.count('<th>')` | `'<thead><tr><th>'` |
| `h.count('<td>')` | `'<tr><td>'` |
| `'"1536"' in h` | `'width="1536" height="1024"'` |
| `'src="assets/images/foundation-studio.webp"' in h` | — |
| `re.search(r'<div class="code-head">\s*<span>(.*?)</span', h, re.S)` | `'<div class="code-head"><span>'` |
| `'class="code"' in h` | `'<pre class="code">'` — Prettier splits `pre` attributes |

---

### Task 1: Hero — API terminal card

Replaces the `page-hero` section with a `hero` section whose right column holds a new dark `.hero-terminal` card. This is the only task that touches CSS.

**Files:**
- Modify: `static-site/build.py` — the `headless` template assignment
- Modify: `static-site/assets/css/site.css` — append one block at end of file

**Interfaces:**
- Consumes: existing helpers `btn(label, href, kind="primary", up=False)`, `arrow(up=False)`, `section_title(kicker, title, description="", more="")`, `final_cta()`
- Produces: CSS class `.hero-terminal`, consumed by this task's markup and available to later tasks

- [ ] **Step 1: Append the `.hero-terminal` CSS block**

Append to the end of `static-site/assets/css/site.css`:

```css
/* Headless page — API terminal hero card */
.hero-terminal{position:relative;z-index:1;min-width:0;background:var(--dark-2);border:1px solid #39444b;border-radius:var(--radius);overflow:hidden;box-shadow:0 26px 60px rgba(15,21,31,.22)}
.hero-terminal .code-head{padding-inline:22px}
.hero-terminal .code{padding:22px;display:block;font-size:.72rem;line-height:1.75}
.hero-terminal .proof-pills{padding:0 22px 20px;margin-top:0}
@media(max-width:620px){.hero-terminal .code{padding:18px;font-size:.66rem}.hero-terminal .code-head{padding-inline:18px}.hero-terminal .proof-pills{padding:0 18px 18px}}
```

`z-index:1` is required: inside `.hero-visual` the decorative `.hero-visual-grid` sits at `z-index:-1` and `.visual-backplate` at `z-index:0`, so without it the card renders behind the backplate.

- [ ] **Step 2: Verify the CSS rules landed**

```bash
cd static-site && python3 - <<'PY'
import pathlib, sys
css = pathlib.Path('assets/css/site.css').read_text()
checks = {
    'hero-terminal base rule': '.hero-terminal{position:relative;z-index:1' in css,
    'code padding override': '.hero-terminal .code{padding:22px' in css,
    'mobile step': '@media(max-width:620px){.hero-terminal .code{padding:18px' in css,
}
for k, v in checks.items():
    print('PASS' if v else 'FAIL', k)
sys.exit(0 if all(checks.values()) else 1)
PY
```

Expected: three `PASS` lines, exit `0`.

- [ ] **Step 3: Replace the `headless` template with the hero-only version**

In `static-site/build.py`, find the assignment beginning with the literal `headless = f'''`. It is a single-line assignment ending in `'''`. Replace that entire assignment — everything from `headless = f'''` up to and including its closing `'''` — with exactly this:

```python
headless = f'''<section class="hero"><div class="container hero-grid"><div class="hero-copy">
  <div class="crumbs"><a href="index.html">Home</a><span>/</span><span>Headless</span></div>
  <span class="eyebrow">TYPO3 beyond templates</span>
  <h1>Content freedom.<br><em>Engineering clarity.</em></h1>
  <p class="lead">Headless project patterns for teams pairing TYPO3 content with a separate frontend. Designed around explicit contracts, editor needs and maintainable delivery.</p>
  <div class="button-row hero-buttons">{btn('Talk about a headless project','contact.html')}</div>
  <div class="hero-proof"><span class="hero-proof-label">BUILT FOR</span><span>TYPO3 13 / 14 LTS</span><span>JSON:API</span><span>Content Blocks</span></div>
</div>
<div class="hero-visual" data-reveal="delay">
  <div class="hero-visual-grid" aria-hidden="true"></div>
  <div class="visual-backplate"></div>
  <div class="hero-terminal">
    <div class="code-head"><span>GET /api/projects</span><button class="copy-btn" type="button" data-copy="GET /api/projects?fields=title,year,cover&amp;page[size]=2">Copy</button></div>
    <pre class="code"><span class="blue">$</span> curl https://cmsmotive.tld/api/projects?fields=title,year,cover
<span class="code-comment"># JSON:API response shape · illustrative, not a released endpoint</span>
{{
  "data": [
    {{
      "type": "project",
      "id": "17",
      "attributes": {{ "title": "Nordheim Library", "year": 2026 }}
    }},
    {{
      "type": "project",
      "id": "18",
      "attributes": {{ "title": "Hafenhalle", "year": 2025 }}
    }}
  ],
  "links": {{ "next": "?page[cursor]=8f2a" }}
}}</pre>
    <div class="proof-pills"><span>JSON:API</span><span>Vary</span><span>Cache-Tags</span><span>Next.js</span></div>
  </div>
</div></div></section>'''
```

Notes on this code:
- Doubled braces `{{` / `}}` are required f-string escaping for the JSON.
- `.hero-browser-motion` is deliberately **not** used — it applies an 8s float animation suited to the homepage image preview that would make a code panel wobble.
- `&amp;` inside the `data-copy` value so the `&` in `page[size]=2` is correctly encoded in the attribute.
- `.crumbs` is a global class and styles correctly inside `.hero`; it is kept because the current page already has a breadcrumb.

- [ ] **Step 4: Rebuild and verify the hero**

```bash
cd static-site && python3 build.py >/dev/null && npx --no-install prettier --write "**/*.html" >/dev/null && python3 - <<'PY'
import pathlib, sys
h = pathlib.Path('headless.html').read_text()
checks = {
    'exactly one section (hero only)': h.count('<section') == 1,
    'hero section': 'class="hero"' in h,
    'hero-terminal card': 'class="hero-terminal"' in h,
    'copy button with data-copy': 'class="copy-btn"' in h and 'data-copy="GET /api/projects' in h,
    'JSON braces rendered literally': '"type": "project"' in h and '{{' not in h,
    'code-comment present': 'class="code-comment"' in h,
    'hero-proof pills': 'class="proof-pills"' in h,
    'crumbs kept': 'class="crumbs"' in h,
    'legacy two-col removed': 'two-col' not in h,
}
for k, v in checks.items():
    print('PASS' if v else 'FAIL', k)
sys.exit(0 if all(checks.values()) else 1)
PY
```

Expected: nine `PASS` lines, exit `0`. If `python3 build.py` fails with `SyntaxError`, the JSON braces were not doubled — see Global Constraints.

- [ ] **Step 5: Confirm the Copy button target matches its visible label**

```bash
cd static-site && python3 - <<'PY'
import pathlib, re, sys
h = pathlib.Path('headless.html').read_text()
m = re.search(r'<div class="code-head">\s*<span>(.*?)</span', h, re.S)
d = re.search(r'data-copy="([^"]*)"', h)
checks = {'code-head found': m is not None, 'data-copy found': d is not None}
if m and d:
    checks['label and copy both reference /api/projects'] = '/api/projects' in m.group(1) and '/api/projects' in d.group(1)
for k, v in checks.items():
    print('PASS' if v else 'FAIL', k)
sys.exit(0 if all(checks.values()) else 1)
PY
```

The `\s*` after `code-head">` and the missing `>` after `</span` are both required — Prettier puts a newline between those tags. Expected: three `PASS` lines, exit `0`.

- [ ] **Step 6: Commit**

```bash
git add static-site/build.py static-site/assets/css/site.css static-site/headless.html
git commit -m "Replace headless page hero with API terminal card"
```

---

### Task 2: "Where it fits" card grid

Adds a section after the hero: three use-case cards with technology pills.

**Files:**
- Modify: `static-site/build.py` — the `headless` template assignment
- Modify: `static-site/assets/css/site.css` — append one rule to the `.hero-terminal` block

**Interfaces:**
- Consumes: `section_title(kicker, title, description="", more="")`; `.article-grid`, `.article-card`, `.proof-pills` from `assets/css/site.css`
- Produces: nothing later tasks depend on

- [ ] **Step 1: Add a light-theme pill override to the CSS block**

`.proof-pills span` is styled for the dark theme (`color:#d6e2e2`, `border:1px solid #4c5a61`). On a white `.article-card` that text is near-white on white — effectively invisible. Append to the `.hero-terminal` block at the end of `static-site/assets/css/site.css`:

```css
.article-card .proof-pills span{border-color:var(--line);color:var(--muted)}
```

- [ ] **Step 2: Insert the card-grid section into the `headless` template**

Insert the block below **immediately before the closing `'''`** of the `headless = f'''...'''` assignment. Start it with a newline so it is not glued to the hero's last line:

```python
<section class="section"><div class="container">
  {section_title('Where it fits', 'One backend. Many surfaces.', 'The same content model can feed a brand site, a client project and a channel that was not designed for a browser.')}
  <div class="article-grid">
    <article class="article-card" data-reveal><span class="badge indigo">Editorial</span><h3>Corporate site</h3><p>Editors keep the interface they already know. What ships is the frontend, not the template layer.</p><div class="proof-pills"><span>Next.js</span><span>ISR</span><span>Preview</span></div></article>
    <article class="article-card" data-reveal="delay"><span class="badge indigo">Client work</span><h3>Agency delivery</h3><p>A different brand for every client, one TYPO3 behind them. Tokens and content stay separable.</p><div class="proof-pills"><span>Multi-site</span><span>Design tokens</span><span>Handover</span></div></article>
    <article class="article-card" data-reveal><span class="badge indigo">Channels</span><h3>Beyond the browser</h3><p>Web, app and kiosk read the same contract, so a content change lands everywhere at once.</p><div class="proof-pills"><span>Web</span><span>App</span><span>Kiosk</span></div></article>
  </div>
</div></section>
```

- [ ] **Step 3: Rebuild and verify**

```bash
cd static-site && python3 build.py >/dev/null && npx --no-install prettier --write "**/*.html" >/dev/null && python3 - <<'PY'
import pathlib, sys
h = pathlib.Path('headless.html').read_text()
css = pathlib.Path('assets/css/site.css').read_text()
checks = {
    'two sections total': h.count('<section') == 2,
    'three article cards': h.count('class="article-card"') == 3,
    'use-case headings': all(t in h for t in ('Corporate site', 'Agency delivery', 'Beyond the browser')),
    'pill override for light cards': '.article-card .proof-pills span{' in css,
    'section_title used': 'Where it fits' in h,
    'pill labels present': all(t in h for t in ('Next.js', 'Multi-site', 'Kiosk')),
}
for k, v in checks.items():
    print('PASS' if v else 'FAIL', k)
sys.exit(0 if all(checks.values()) else 1)
PY
```

Expected: six `PASS` lines, exit `0`.

- [ ] **Step 4: Commit**

```bash
git add static-site/build.py static-site/assets/css/site.css static-site/headless.html
git commit -m "Add use-case card grid to headless page"
```

---

### Task 3: Reference architecture dark section

Adds the dark section, and this is where `.proof-panel.large` is used as designed for the first time.

**Files:**
- Modify: `static-site/build.py` — the `headless` template assignment

**Interfaces:**
- Consumes: `btn(label, href, kind="primary", up=False)`; `.dark-section`, `.proof-intro`, `.proof-grid`, `.proof-panel`, `.proof-panel.large`, `.panel-top`, `.code-head`, `.copy-btn`, `.code`, `.code-comment`, `.file-tree`, `.proof-pills`
- Produces: nothing later tasks depend on

- [ ] **Step 1: Insert the dark section into the `headless` template**

Insert the block below **immediately before the closing `'''`** of the `headless = f'''...'''` assignment, starting with a newline:

```python
<section class="section dark-section"><div class="container">
  <div class="proof-intro" data-reveal><div><span class="eyebrow">Reference architecture</span><h2>The contract is the product.</h2></div><p>Splitting the frontend only pays off when the agreement between TYPO3 and that frontend is explicit, versioned and documented.</p></div>
  <div class="proof-grid">
    <div class="proof-panel large" data-reveal>
      <div class="panel-top"><div><h3>A content model the frontend can trust.</h3><p>Fields, types and relations are declared once and read from anywhere.</p></div><span class="badge dark">01 / Contract</span></div>
      <div class="code-head"><span>GET /api/projects?include=media</span><button class="copy-btn" type="button" data-copy="GET /api/projects?include=media&amp;page[size]=2">Copy</button></div>
      <pre class="code"><span class="blue">$</span> curl &hellip;/api/projects?include=media
<span class="code-comment"># one relation, resolved server-side</span>
{{
  "data": {{
    "type": "project",
    "id": "17",
    "attributes": {{ "title": "Nordheim Library" }},
    "relationships": {{
      "media": {{ "data": [{{ "type": "file", "id": "402" }}] }}
    }}
  }}
}}</pre>
      <div class="file-tree"><b>Configuration/</b><br />├── ContentBlocks/<br />│ &nbsp; └── Project.yaml<br />├── TypoScript/<br />│ &nbsp; └── ContentTypes.typoscript<br />└── Sites/<br />&nbsp;&nbsp;&nbsp; └── config.yaml</div>
    </div>
    <div class="proof-panel" data-reveal><span class="badge dark">02 / Delivery</span><h3 class="proof-panel-title">Cache where it pays.</h3><p>Cache headers and surrogate keys are part of the contract, not an afterthought added after launch.</p><div class="proof-pills"><span>CDN</span><span>Cache-Tags</span><span>Stale-While-Revalidate</span></div></div>
    <div class="proof-panel" data-reveal="delay"><span class="badge dark">03 / Editors</span><h3 class="proof-panel-title">Editors never see the API.</h3><p>Content Blocks and workspaces stay in TYPO3. The contract is something the delivery team owns.</p><div class="proof-pills"><span>Content Blocks</span><span>Workspace</span><span>Preview</span></div></div>
  </div>
</div></section>
```

- [ ] **Step 2: Rebuild and verify**

```bash
cd static-site && python3 build.py >/dev/null && npx --no-install prettier --write "**/*.html" >/dev/null && python3 - <<'PY'
import pathlib, sys
h = pathlib.Path('headless.html').read_text()
checks = {
    'three sections total': h.count('<section') == 3,
    'dark section present': 'class="section dark-section"' in h,
    'one large panel': h.count('class="proof-panel large"') == 1,
    'two small panels': h.count('class="proof-panel"') == 2,
    'three panels overall': h.count('class="proof-panel"') + h.count('class="proof-panel large"') == 3,
    'proof-intro present': 'class="proof-intro"' in h,
    'large panel code-head label': 'GET /api/projects?include=media' in h,
    'file-tree present': 'class="file-tree"' in h,
    'no stray f-string braces': '{{' not in h and '}}' not in h,
}
for k, v in checks.items():
    print('PASS' if v else 'FAIL', k)
sys.exit(0 if all(checks.values()) else 1)
PY
```

Expected: nine `PASS` lines, exit `0`. `h.count('class="proof-panel')` counts the `large` variant too, so 1 large + 2 small = 3.

- [ ] **Step 3: Confirm the grid has exactly three panel children**

```bash
cd static-site && python3 - <<'PY'
import pathlib, re, sys
h = pathlib.Path('headless.html').read_text()
m = re.search(r'<div class="proof-grid">', h)
checks = {'proof-grid found': m is not None}
if m:
    tail = h[m.end():]
    end = tail.find('</section>')
    inner = tail[:end]
    checks['exactly 3 panels before section end'] = inner.count('class="proof-panel"') + inner.count('class="proof-panel large"') == 3
    checks['large panel is first child'] = inner.lstrip().startswith('<div class="proof-panel large"')
for k, v in checks.items():
    print('PASS' if v else 'FAIL', k)
sys.exit(0 if all(checks.values()) else 1)
PY
```

Expected: three `PASS` lines, exit `0`. Count with the closing quote (`class="proof-panel"`) — the bare prefix also matches `class="proof-panel-title"` and inflates the result to 5.

- [ ] **Step 4: Commit**

```bash
git add static-site/build.py static-site/headless.html
git commit -m "Add reference architecture section to headless page"
```

---

### Task 4: Decision callout

Adds the indigo callout that balances the dark section with a light, image-backed block.

**Files:**
- Modify: `static-site/build.py` — the `headless` template assignment

**Interfaces:**
- Consumes: `btn(label, href, kind="primary", up=False)`; `.callout`, `.callout-copy`, `.callout-art`, `.callout-mini`; image `assets/images/foundation-studio.webp`
- Produces: nothing later tasks depend on

- [ ] **Step 1: Insert the callout into the `headless` template**

Insert the block below **immediately before the closing `'''`** of the `headless = f'''...'''` assignment, starting with a newline:

```python
<section class="section-sm"><div class="container"><div class="callout" data-reveal>
  <div class="callout-copy"><span class="eyebrow light">Before you split</span><h2>Headless buys freedom. It costs a contract.</h2><p>The API becomes an interface you have to design, document, version and keep stable. That is worth it for the right project and pure overhead for the wrong one.</p><div class="button-row">{btn('Discuss your architecture','contact.html','light')}</div></div>
  <div class="callout-art"><div class="callout-mini"><img src="assets/images/foundation-studio.webp" alt="Studio interior representing a considered frontend build" width="1536" height="1024" loading="lazy"></div></div>
</div></div></section>
```

- [ ] **Step 2: Rebuild and verify**

```bash
cd static-site && python3 build.py >/dev/null && npx --no-install prettier --write "**/*.html" >/dev/null && python3 - <<'PY'
import pathlib, sys
h = pathlib.Path('headless.html').read_text()
checks = {
    'four sections total': h.count('<section') == 4,
    'callout present': 'class="callout"' in h,
    'callout art present': 'class="callout-art"' in h and 'class="callout-mini"' in h,
    'image src correct': 'src="assets/images/foundation-studio.webp"' in h,
    'image has width attr': '"1536"' in h,
    'image has alt text': 'alt="Studio interior' in h,
    'light eyebrow variant': 'class="eyebrow light"' in h,
    'cta to contact': 'Discuss your architecture' in h,
}
for k, v in checks.items():
    print('PASS' if v else 'FAIL', k)
sys.exit(0 if all(checks.values()) else 1)
PY
```

Expected: eight `PASS` lines, exit `0`.

- [ ] **Step 3: Commit**

```bash
git add static-site/build.py static-site/headless.html
git commit -m "Add decision callout to headless page"
```

---

### Task 5: Template vs headless comparison table

Adds the decision table so the page answers "should we go headless at all" rather than only describing how.

**Files:**
- Modify: `static-site/build.py` — the `headless` template assignment

**Interfaces:**
- Consumes: `section_title(kicker, title, description="", more="")`; `.compare-table` (already used by `theme-nordform.html`, so the markup shape is known-good)
- Produces: nothing later tasks depend on

- [ ] **Step 1: Insert the table section into the `headless` template**

Insert the block below **immediately before the closing `'''`** of the `headless = f'''...'''` assignment, starting with a newline:

```python
<section class="section"><div class="container">
  {section_title('Decision', 'Template or headless?', 'A short comparison, not a rule. The right answer depends on who maintains the frontend after launch.')}
  <table class="compare-table">
    <thead><tr><th>Area</th><th>Template-based</th><th>Headless</th></tr></thead>
    <tbody>
      <tr><td>Content ownership</td><td>TYPO3 owns markup and content</td><td>TYPO3 owns content, the app owns markup</td></tr>
      <tr><td>Frontend freedom</td><td>Bounded by Fluid templates</td><td>Any framework, any deployment</td></tr>
      <tr><td>Editor effort</td><td>Low — one interface</td><td>Higher — preview and publishing need care</td></tr>
      <tr><td>Infrastructure</td><td>One application to run</td><td>API plus frontend, plus cache layer</td></tr>
      <tr><td>Best when</td><td>The site is the product</td><td>Content feeds several surfaces</td></tr>
    </tbody>
  </table>
</div></section>
```

- [ ] **Step 2: Rebuild and verify**

```bash
cd static-site && python3 build.py >/dev/null && npx --no-install prettier --write "**/*.html" >/dev/null && python3 - <<'PY'
import pathlib, sys
h = pathlib.Path('headless.html').read_text()
checks = {
    'five sections total': h.count('<section') == 5,
    'compare table present': '<table class="compare-table">' in h,
    'three header cells': h.count('<th>') == 3,
    'fifteen body cells (3 x 5 rows)': h.count('<td>') == 15,
    'thead and tbody present': '<thead>' in h and '<tbody>' in h,
    'column labels': 'Template-based' in h and '>Headless<' in h,
    'row labels': all(t in h for t in ('Content ownership', 'Frontend freedom', 'Editor effort', 'Infrastructure', 'Best when')),
}
for k, v in checks.items():
    print('PASS' if v else 'FAIL', k)
sys.exit(0 if all(checks.values()) else 1)
PY
```

Expected: seven `PASS` lines, exit `0`.

- [ ] **Step 3: Commit**

```bash
git add static-site/build.py static-site/headless.html
git commit -m "Add template vs headless comparison table"
```

---

### Task 6: Closing final-cta

Gives the page the same ending rhythm as `index.html`.

**Files:**
- Modify: `static-site/build.py` — the `headless` template assignment

**Interfaces:**
- Consumes: `final_cta()` (zero-argument helper, already used by `index.html`)
- Produces: nothing

- [ ] **Step 1: Insert the closing CTA into the `headless` template**

Insert the line below **immediately before the closing `'''`** of the `headless = f'''...'''` assignment, starting with a newline:

```python
{final_cta()}
```

- [ ] **Step 2: Rebuild and verify**

```bash
cd static-site && python3 build.py >/dev/null && npx --no-install prettier --write "**/*.html" >/dev/null && python3 - <<'PY'
import pathlib, sys
h = pathlib.Path('headless.html').read_text()
idx = pathlib.Path('index.html').read_text()
checks = {
    'six sections total': h.count('<section') == 6,
    'final cta present': 'class="section-sm final-cta-section"' in h,
    'exactly one final cta': h.count('final-cta-section') == 1,
    'closing logo present': 'assets/icons/favicon.png' in h,
    'no duplicate cta headline': h.count('feel like progress.') == 1,
    'index still has its own cta': idx.count('final-cta-section') == 1,
}
for k, v in checks.items():
    print('PASS' if v else 'FAIL', k)
sys.exit(0 if all(checks.values()) else 1)
PY
```

Expected: six `PASS` lines, exit `0`.

- [ ] **Step 3: Commit**

```bash
git add static-site/build.py static-site/headless.html
git commit -m "Close headless page with final CTA"
```

---

### Task 7: Responsive and regression verification

Final pass. Confirms the page holds up across breakpoints and that nothing else in the site regressed.

**Files:**
- Verify only — no edits expected

**Interfaces:**
- Consumes: the finished `headless` template and `.hero-terminal` CSS from Tasks 1–6
- Produces: nothing

- [ ] **Step 1: Confirm the whole site builds and Prettier reports no drift**

```bash
cd static-site && python3 build.py && npx --no-install prettier --check "**/*.html"
```

Expected: `Built 20 site pages and 5 auth pages`, then `All matched files use Prettier code style!`, exit `0`.

**Do not run `prettier --check` on `assets/css/site.css`.** That file does not follow Prettier formatting and never has — its rules are hand-written one-liners. Running `--write` on it would explode the whole stylesheet into a several-thousand-line diff. The project formats HTML only.

If Prettier reports files, the working tree was edited outside `build.py`. Run `npx --no-install prettier --write "**/*.html"` and re-check.

- [ ] **Step 2: Confirm no regressions elsewhere**

```bash
cd static-site && python3 - <<'PY'
import pathlib, sys
pages = sorted(pathlib.Path('.').glob('*.html'))
texts = {p.name: p.read_text() for p in pages}
checks = {
    '20 top-level pages': len(pages) == 20,
    'all pages have header logo': all('class="logo logo-header"' in t for t in texts.values()),
    'all pages have Contact nav item': all('href="contact.html">Contact' in t for t in texts.values()),
    'no Sign in in site nav': not any('auth/login.html">Sign in' in t for t in texts.values()),
    'no cmsmotive.com left': not any('cmsmotive.com' in t for t in texts.values()),
    'no phone or telephone': not any('Telephone' in t or 'Number to be confirmed' in t for t in texts.values()),
    'headless has six sections': texts['headless.html'].count('<section') == 6,
}
for k, v in checks.items():
    print('PASS' if v else 'FAIL', k)
sys.exit(0 if all(checks.values()) else 1)
PY
```

Expected: seven `PASS` lines, exit `0`.

- [ ] **Step 3: Confirm responsive behaviour is expressed in CSS, not left to chance**

```bash
cd static-site && python3 - <<'PY'
import pathlib, sys
css = pathlib.Path('assets/css/site.css').read_text()
base = css.split('.hero-terminal{')[1].split('}')[0]
checks = {
    'hero-terminal has mobile step': '@media(max-width:620px){.hero-terminal .code{padding:18px' in css,
    'hero-terminal has min-width guard': 'min-width:0' in base,
    'hero-terminal sits above backplate': 'z-index:1' in base,
    'article-card pills themed for light bg': '.article-card .proof-pills span{' in css,
    'hero collapses at 900px': '.hero-grid{grid-template-columns:1fr}' in css,
    'proof grid collapses at 620px': '.proof-intro,.proof-grid,.two-col' in css,
    'code wraps on narrow screens': 'white-space:pre-wrap' in css and 'overflow-wrap:anywhere' in css,
}
for k, v in checks.items():
    print('PASS' if v else 'FAIL', k)
sys.exit(0 if all(checks.values()) else 1)
PY
```

Expected: seven `PASS` lines, exit `0`.

- [ ] **Step 4: Visually confirm the page in the browser**

The user already serves the site at `http://127.0.0.1:5500/static-site/headless.html`. Check at three widths:

| Width | Expected |
|---|---|
| ~1440px | 6 sections; terminal card sits above the decorative backplate; dark section shows one tall left panel and two short right panels with no empty column |
| ~900px | hero stacks copy above card; article cards drop to 2-up then 1-up; proof grid stacks and the large panel no longer spans 2 rows |
| ~390px | terminal code wraps instead of scrolling horizontally; pills wrap; table scrolls horizontally without breaking the layout |

If horizontal scrolling appears at phone width, add `overflow-x:auto` to the existing `.compare-table` rule inside the `@media(max-width:620px)` block rather than shrinking the terminal code.

- [ ] **Step 5: Commit any fixes from Step 4**

```bash
git add static-site/build.py static-site/assets/css/site.css static-site/headless.html
git commit -m "Fix headless page responsive details"
```

Skip this step if Step 4 required no changes.
