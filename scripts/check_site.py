#!/usr/bin/env python3
"""Static checks for the homepage. No dependencies beyond the standard library
(pdftotext is used for the CV if it is installed).

Run locally from the repository root:  python3 scripts/check_site.py
"""
import base64
import datetime
import html.parser
import json
import os
import re
import shutil
import subprocess
import sys
import xml.dom.minidom
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://donaldshawnshang.github.io'
IN_ACTIONS = os.environ.get('GITHUB_ACTIONS') == 'true'
SKIP_DIRS = {'.git', '.github', 'scripts', 'node_modules'}
TEXT_EXT = ('.html', '.txt', '.xml', '.js', '.css', '.vcf', '.md', '.svg')
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

errors, warnings = [], []


def report(kind, path, msg):
    (errors if kind == 'error' else warnings).append((path, msg))


def rel(path):
    return os.path.relpath(path, ROOT)


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def served_files():
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            yield os.path.join(dirpath, name)


# ---------------------------------------------------------------- HTML model

class Page(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids, self.links, self.stack, self.problems = set(), [], [], []
        self.section = None
        self.li_count = {}
        self.ld_json, self._in_ld = [], False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a:
            self.ids.add(a['id'])
        for key in ('href', 'src'):
            if a.get(key):
                self.links.append(a[key])
        if tag == 'section' and a.get('id'):
            self.section = a['id']
        if tag == 'li' and self.section:
            self.li_count[self.section] = self.li_count.get(self.section, 0) + 1
        if tag == 'script' and a.get('type') == 'application/ld+json':
            self._in_ld = True
            self.ld_json.append('')
        if tag not in VOID:
            self.stack.append((tag, self.getpos()[0]))

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if tag == 'section':
            self.section = None
        if tag == 'script':
            self._in_ld = False
        if self.stack and self.stack[-1][0] == tag:
            self.stack.pop()
        else:
            opened = self.stack[-1] if self.stack else ('nothing', 0)
            self.problems.append(f'line {self.getpos()[0]}: </{tag}> closes <{opened[0]}> opened on line {opened[1]}')

    def handle_data(self, data):
        if self._in_ld:
            self.ld_json[-1] += data


PAGES = {}


def page(path):
    if path not in PAGES:
        p = Page()
        p.feed(read(path))
        p.close()
        PAGES[path] = p
    return PAGES[path]


def local_target(src, path):
    target = os.path.join(ROOT, path.lstrip('/')) if path.startswith('/') else os.path.normpath(os.path.join(os.path.dirname(src), path))
    if os.path.isdir(target):
        target = os.path.join(target, 'index.html')
    return target


# ---------------------------------------------------------------- checks

def check_html():
    for path in served_files():
        if not path.endswith('.html'):
            continue
        p = page(path)
        for prob in p.problems:
            report('error', path, 'unbalanced tags, ' + prob)
        for tag, line in p.stack:
            report('error', path, f'<{tag}> opened on line {line} is never closed')
        for block in p.ld_json:
            try:
                json.loads(block)
            except ValueError as e:
                report('error', path, f'JSON-LD does not parse: {e}')
        for url in p.links:
            if re.match(r'^(https?:|mailto:|tel:|data:|javascript:)', url) or url.startswith('//'):
                continue
            target_path, _, frag = url.partition('#')
            target_path = target_path.split('?')[0]
            if not target_path:
                if frag and frag not in p.ids:
                    report('error', path, f'link "{url}" points to a missing id on this page')
                continue
            target = local_target(path, target_path)
            if not os.path.exists(target):
                report('error', path, f'link "{url}" points to a missing file ({rel(target)})')
            elif frag and target.endswith('.html') and frag not in page(target).ids:
                report('error', path, f'link "{url}": no id "{frag}" in {rel(target)}')
            elif frag and target.endswith('.svg') and f'id="{frag}"' not in read(target):
                report('error', path, f'icon "{url}": no symbol "{frag}" in {rel(target)}')


def check_privacy():
    """Rules for anything published: no under-review work, no advisor, no phone number."""
    rules = [
        (re.compile(r'skill\s?gauge|skill\s?vigil|malskillbench', re.I), 'mentions an under-review paper (double-blind)'),
        (re.compile(r'\badvis(?:ed|or)\b|导师', re.I), 'mentions the advisor'),
        (re.compile(r'(?<![\d.])(?:\+?86[\s-]?)?1[3-9]\d[\s-]?\d{4}[\s-]?\d{4}(?![\d.])'), 'contains what looks like a phone number'),
    ]
    sources = [(p, read(p)) for p in served_files() if p.endswith(TEXT_EXT)]
    cv = os.path.join(ROOT, 'assets', 'cv', 'Wentao_Shang_CV.pdf')
    if os.path.exists(cv):
        if shutil.which('pdftotext'):
            sources.append((cv, subprocess.run(['pdftotext', '-layout', cv, '-'], capture_output=True, text=True).stdout))
        else:
            report('warning', cv, 'pdftotext is not installed; the CV was not scanned')
    for path, text in sources:
        for pattern, why in rules:
            m = pattern.search(text)
            if m:
                report('error', path, f'{why}: "{m.group(0)}"')


def check_injection_text():
    """The demo's injected instruction may only exist base64-encoded inside demo.js."""
    demo_js = os.path.join(ROOT, 'assets', 'js', 'demo.js')
    m = re.search(r'var PAYLOAD = (\{.*?\});', read(demo_js), re.S)
    if not m:
        report('error', demo_js, 'could not find the PAYLOAD table')
        return
    phrases = ['Note to the AI assistant', '给 AI 助手的备注']
    for b64 in json.loads(m.group(1)).values():
        decoded = base64.b64decode(b64).decode('utf-8')
        phrases += [decoded, decoded[:30]]
    for path in served_files():
        if not path.endswith(TEXT_EXT) or path == demo_js:
            continue
        text = read(path)
        for phrase in phrases:
            if phrase in text:
                report('error', path, f'contains the demo injection text as plain text: "{phrase[:40]}..."')
                break


def check_pairs():
    """English and Chinese versions must have the same structure and the same external links."""
    def ext_links(p):
        out = set()
        for url in p.links:
            if url.startswith(('http://', 'https://')):
                u = urlparse(url)
                out.add(u.netloc + u.path)
        return out

    for en, zh in [('index.html', 'zh/index.html'), ('demo/index.html', 'zh/demo/index.html'),
                   ('autoguard/index.html', 'zh/autoguard/index.html')]:
        en_p, zh_p = os.path.join(ROOT, en), os.path.join(ROOT, zh)
        if not (os.path.exists(en_p) and os.path.exists(zh_p)):
            report('error', en_p, f'missing language pair {en} / {zh}')
            continue
        a, b = page(en_p), page(zh_p)
        if a.ids != b.ids:
            report('error', zh_p, f'ids differ from {en}: only EN {sorted(a.ids - b.ids)}, only ZH {sorted(b.ids - a.ids)}')
        if a.li_count != b.li_count:
            report('error', zh_p, f'list items per section differ from {en}: EN {a.li_count}, ZH {b.li_count}')
        if ext_links(a) != ext_links(b):
            report('error', zh_p, f'external links differ from {en}: only EN {sorted(ext_links(a) - ext_links(b))}, only ZH {sorted(ext_links(b) - ext_links(a))}')


def check_llms():
    path = os.path.join(ROOT, 'llms.txt')
    text = read(path)
    home = read(os.path.join(ROOT, 'index.html'))
    for url in re.findall(re.escape(SITE) + r'(/[^\s)\]]*)', text):
        target = local_target(path, url.split('#')[0].split('?')[0])
        if not os.path.exists(target):
            report('error', path, f'links to {SITE}{url}, but {rel(target)} does not exist')
    for fact, pattern in [('email', r'[\w.+-]+@[\w-]+\.[\w.]+'), ('ORCID', r'\d{4}-\d{4}-\d{4}-\d{3}[\dX]'), ('DOI', r'10\.\d{4,}/[^\s)"<}]+')]:
        in_home = set(re.findall(pattern, home))
        in_llms = set(re.findall(pattern, text))
        if in_home - in_llms:
            report('error', path, f'{fact} on the homepage but not in llms.txt: {sorted(in_home - in_llms)}')
    norm = lambda s: re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', s)).strip().casefold()
    for title in re.findall(r'class="paper-title"[^>]*>(.*?)</h3>', home, re.S):
        if norm(title) not in norm(text):
            report('error', path, f'paper on the homepage is missing here: "{norm(title)[:60]}..."')


def check_site_files():
    # security.txt must not expire
    sec = os.path.join(ROOT, '.well-known', 'security.txt')
    m = re.search(r'^Expires:\s*(\S+)', read(sec), re.M)
    if not m:
        report('error', sec, 'no Expires field')
    else:
        expires = datetime.datetime.fromisoformat(m.group(1).replace('Z', '+00:00'))
        left = (expires - datetime.datetime.now(datetime.timezone.utc)).days
        if left < 0:
            report('error', sec, f'expired on {m.group(1)}')
        elif left < 60:
            report('warning', sec, f'expires in {left} days ({m.group(1)}); update the Expires date')
    # sitemap entries must exist
    smap = os.path.join(ROOT, 'sitemap.xml')
    try:
        dom = xml.dom.minidom.parse(smap)
        for loc in dom.getElementsByTagName('loc'):
            url = loc.firstChild.data.strip()
            if not url.startswith(SITE) or not os.path.exists(local_target(smap, url[len(SITE):] or '/')):
                report('error', smap, f'entry {url} has no matching page')
    except Exception as e:  # noqa: BLE001
        report('error', smap, f'does not parse: {e}')
    # robots.txt must point at the sitemap
    if f'Sitemap: {SITE}/sitemap.xml' not in read(os.path.join(ROOT, 'robots.txt')):
        report('error', os.path.join(ROOT, 'robots.txt'), 'missing the Sitemap line')


def main():
    for check in (check_html, check_privacy, check_injection_text, check_pairs, check_llms, check_site_files):
        check()
    for kind, items in (('error', errors), ('warning', warnings)):
        for path, msg in items:
            if IN_ACTIONS:
                print(f'::{kind} file={rel(path)}::{msg}')
            else:
                print(f'{kind.upper():8} {rel(path)}: {msg}')
    print(f'\n{len(errors)} error(s), {len(warnings)} warning(s) in {len(PAGES)} HTML pages.')
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
