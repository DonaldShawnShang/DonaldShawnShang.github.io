// Terminal mode: press ` (backquote) or click >_ in the top bar.
// Every file is read from the page itself, so the terminal always matches the site
// (and shows Chinese content on the Chinese page).
(function () {
  var zh = document.documentElement.lang.indexOf('zh') === 0;
  function T(en, cn) { return zh ? cn : en; }

  function clean(t) { return (t || '').replace(/\s+/g, ' ').trim(); }
  function abs(href) { try { return new URL(href, location.href).href; } catch (e) { return href; } }
  function textWithTags(el) {
    var c = el.cloneNode(true);
    c.querySelectorAll('.tag').forEach(function (t) { t.textContent = ' [' + t.textContent + ']'; });
    c.querySelectorAll('.sep').forEach(function (t) { t.textContent = ' | '; });
    return clean(c.textContent);
  }

  // ---------- virtual file system, built from the page ----------
  function buildFS() {
    var fs = { type: 'dir', children: {} };
    function dir(parent, name) { var d = { type: 'dir', children: {} }; parent.children[name] = d; return d; }
    function file(parent, name, lines) { parent.children[name] = { type: 'file', lines: lines }; }
    function link(parent, name, url, lines) { parent.children[name] = { type: 'link', url: url, lines: lines || [url] }; }
    function remote(parent, name, url) { parent.children[name] = { type: 'remote', url: url }; }
    function listOf(sel) { return Array.prototype.map.call(document.querySelectorAll(sel), function (el) { return clean(el.textContent); }); }

    // about.txt
    var about = [];
    var name = document.querySelector('.profile-name'), alt = document.querySelector('.profile-name-zh');
    if (name) about.push(clean(name.textContent) + (alt ? '  |  ' + clean(alt.textContent) : ''));
    listOf('.profile-role > span').forEach(function (r) { about.push(r); });
    document.querySelectorAll('#about > p, #about .interests li').forEach(function (el) { about.push('', clean(el.textContent)); });
    file(fs, 'about.txt', about);

    // research.txt: the research-focus bullets and the pages they link to
    var research = [];
    document.querySelectorAll('#about .interests li').forEach(function (li) {
      research.push(clean(li.textContent));
      var a = li.querySelector('a[href^="/"]');
      if (a) research.push('  -> ' + abs(a.getAttribute('href')));
      research.push('');
    });
    file(fs, 'research.txt', research.slice(0, -1));

    file(fs, 'news.txt', listOf('#news li'));
    file(fs, 'honors.txt', listOf('#honors li'));
    file(fs, 'education.txt', listOf('#education li'));
    file(fs, 'service.txt', listOf('#service li'));

    // contact.txt
    var contact = [];
    document.querySelectorAll('.profile-links li').forEach(function (li) {
      var a = li.querySelector('a');
      if (!a) { contact.push(clean(li.textContent)); return; }
      var href = a.getAttribute('href');
      contact.push((clean(a.textContent) + ':').padEnd(18) + (href.indexOf('mailto:') === 0 ? href.slice(7) : abs(href)));
    });
    var callout = document.querySelector('#about .callout');
    if (callout) contact.push('', clean(callout.textContent));
    contact.push('', T('Type `hire` to start an email, or `copy email`.', '输入 `hire` 直接写邮件，或输入 `copy email` 复制邮箱。'));
    file(fs, 'contact.txt', contact);

    // publications/<paper>.txt and <paper>.bib
    var pubs = dir(fs, 'publications');
    document.querySelectorAll('.paper-box').forEach(function (box) {
      var key = (box.id || 'paper').replace(/^pub-/, '');
      var lines = [];
      var q = function (sel) { return box.querySelector(sel); };
      if (q('.paper-title')) lines.push(clean(q('.paper-title').textContent));
      if (q('.paper-authors')) lines.push(clean(q('.paper-authors').textContent));
      if (q('.paper-venue')) lines.push(textWithTags(q('.paper-venue')));
      if (q('.paper-tldr')) lines.push('', clean(q('.paper-tldr').textContent));
      lines.push('');
      var links = Array.prototype.map.call(box.querySelectorAll('.paper-links a'), function (a) {
        return [clean(a.textContent) + ':', abs(a.getAttribute('href'))];
      });
      var width = links.reduce(function (w, l) { return Math.max(w, l[0].length + 1); }, 0);
      links.forEach(function (l) { lines.push(l[0].padEnd(width) + l[1]); });
      var bib = q('.bibtex pre');
      if (bib) {
        file(pubs, key + '.bib', bib.textContent.split('\n'));
        lines.push('', T('Copy the citation: copy publications/', '复制引用：copy publications/') + key + '.bib');
      }
      file(pubs, key + '.txt', lines);
    });

    // projects/: pages linked from the research bullets
    var projects = dir(fs, 'projects');
    document.querySelectorAll('#about .interests a[href^="/"]').forEach(function (a) {
      var href = a.getAttribute('href');
      var slug = href.replace(/^\/(zh\/)?/, '').replace(/\/$/, '') || 'home';
      link(projects, slug + '.html', abs(href), [clean(a.textContent), abs(href), '', T('Type `open projects/', '输入 `open projects/') + slug + T('.html` to open it.', '.html` 打开。')]);
    });

    var cv = document.querySelector('.profile-links a[href$=".pdf"]');
    if (cv) link(fs, 'cv.pdf', abs(cv.getAttribute('href')));
    remote(fs, 'llms.txt', '/llms.txt');
    return fs;
  }

  var FS = null;
  var cwd = [], prevCwd = [];
  var EMAIL = (function () {
    var a = document.querySelector('.profile-links a[href^="mailto:"]');
    return a ? a.getAttribute('href').slice(7) : 'shangwentao3@outlook.com';
  })();

  function pathStr(parts) { return '~' + (parts.length ? '/' + parts.join('/') : ''); }

  function resolve(path) {
    var parts = (path && (path[0] === '~' || path[0] === '/')) ? [] : cwd.slice();
    (path || '').replace(/^~/, '').split('/').forEach(function (seg) {
      if (!seg || seg === '.') return;
      if (seg === '..') parts.pop(); else parts.push(seg);
    });
    var node = FS;
    for (var i = 0; i < parts.length; i++) {
      if (!node || node.type !== 'dir') return { node: null, parts: parts };
      node = node.children[parts[i]];
    }
    return { node: node || null, parts: parts };
  }

  // every node in the tree with its path from ~
  function allPaths() {
    var list = [];
    (function walk(node, parts) {
      Object.keys(node.children).forEach(function (n) {
        var child = node.children[n], p = parts.concat(n);
        list.push({ node: child, parts: p });
        if (child.type === 'dir') walk(child, p);
      });
    })(FS, []);
    return list;
  }

  // Like resolve(), but a name that is not in the current directory is looked up in the
  // whole tree, so `cat news.txt` also works from ~/publications.
  function lookup(path) {
    var r = resolve(path);
    if (r.node || !path || path[0] === '~' || path[0] === '/') return r;
    var want = path.split('/').filter(function (seg) { return seg && seg !== '.'; });
    if (!want.length || want.indexOf('..') >= 0) return r;
    var hits = allPaths().filter(function (e) { return e.parts.slice(-want.length).join('/') === want.join('/'); });
    return hits.length === 1 ? { node: hits[0].node, parts: hits[0].parts } : r;
  }

  function basenames(dirsOnly) {
    var seen = {};
    return allPaths().filter(function (e) { return !dirsOnly || e.node.type === 'dir'; }).map(function (e) {
      return e.parts[e.parts.length - 1] + (e.node.type === 'dir' ? '/' : '');
    }).filter(function (n) { return seen[n] ? false : (seen[n] = true); });
  }

  function entries(dirNode, dirsOnly) {
    return Object.keys(dirNode.children)
      .filter(function (n) { return !dirsOnly || dirNode.children[n].type === 'dir'; })
      .map(function (n) { return dirNode.children[n].type === 'dir' ? n + '/' : n; });
  }

  function distance(a, b) {
    var d = [];
    for (var i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (var j = 1; j <= b.length; j++) { d[0][j] = j; }
    for (i = 1; i <= a.length; i++) {
      for (j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return d[a.length][b.length];
  }

  function closest(word, pool) {
    var best = null, bestD = 3;
    pool.forEach(function (p) {
      var bare = p.replace(/\/$/, '');
      var dd = bare.toLowerCase().indexOf(word.toLowerCase()) === 0 ? 0.5 : distance(word.toLowerCase(), bare.toLowerCase());
      if (dd < bestD) { bestD = dd; best = p; }
    });
    return best;
  }

  function notFound(cmd, arg) {
    var slash = arg.lastIndexOf('/');
    var parent = resolve(slash >= 0 ? arg.slice(0, slash) || '/' : '').node;
    var base = slash >= 0 ? arg.slice(slash + 1) : arg;
    var msg = [cmd + ': ' + arg + T(': No such file or directory', '：没有这个文件或目录')];
    var guess = parent && parent.type === 'dir' ? closest(base, entries(parent)) : null;
    var full = guess && (slash >= 0 ? arg.slice(0, slash + 1) : '') + guess;
    if (!full && slash < 0) full = closest(base, basenames(cmd === 'cd'));
    if (full) msg.push(T('Did you mean `' + cmd + ' ' + full + '`?', '你是不是想输入 `' + cmd + ' ' + full + '`？'));
    return msg;
  }

  // ---------- output ----------
  var overlay, out, input, ghostTyped, ghostRest, promptEl, titleEl, history = [], hIdx = 0, lastFocus;

  function line(text, cls) {
    var div = document.createElement('div');
    if (cls) div.className = cls;
    if (text === '') text = ' ';
    // make URLs clickable
    var re = /https?:\/\/[^\s)]+/g, last = 0, m;
    while ((m = re.exec(text))) {
      div.appendChild(document.createTextNode(text.slice(last, m.index)));
      var a = document.createElement('a');
      a.href = a.textContent = m[0];
      a.target = '_blank';
      a.rel = 'noopener';
      div.appendChild(a);
      last = m.index + m[0].length;
    }
    div.appendChild(document.createTextNode(text.slice(last)));
    out.appendChild(div);
    return div;
  }
  function print(lines, cls) {
    (lines || []).forEach(function (l) { line(l, cls); });
    scroll();
  }
  function scroll() { out.parentNode.scrollTop = out.parentNode.scrollHeight; }

  // a row of clickable names (used by ls and by Tab when several names match)
  function printEntries(names, base, onlyComplete) {
    var div = document.createElement('div');
    div.className = 'term-entries';
    names.forEach(function (n) {
      var node = lookup((base ? base + '/' : '') + n.replace(/\/$/, '')).node;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'term-entry' + (node && node.type === 'dir' ? ' is-dir' : node && node.type !== 'file' ? ' is-link' : '');
      b.textContent = n;
      b.title = node && node.type === 'dir' ? 'cd ' + n : (node && node.type === 'link' ? 'open ' : 'cat ') + n;
      b.addEventListener('click', function () {
        var target = (base ? base + '/' : '') + n.replace(/\/$/, '');
        if (onlyComplete) { input.value = onlyComplete + n; updateGhost(); input.focus(); return; }
        run(node && node.type === 'dir' ? 'cd ' + target + ' && ls' : (node && node.type === 'link' ? 'open ' : 'cat ') + target);
        input.focus();
      });
      div.appendChild(b);
    });
    out.appendChild(div);
    scroll();
  }

  function setPrompt() {
    var p = 'visitor@wentao:' + pathStr(cwd) + '$';
    promptEl.textContent = p;
    titleEl.textContent = 'visitor@wentao: ' + pathStr(cwd);
    return p;
  }

  // ---------- commands ----------
  var PATH_CMDS = { cat: 1, cd: 1, ls: 1, open: 1, copy: 1, tree: 1 };

  function contentOf(node) {
    if (node.type === 'link') return node.url;
    return node.lines ? node.lines.join('\n') : '';
  }

  // remote files (llms.txt) are fetched once when the terminal opens
  function load(node) {
    if (node.lines) return Promise.resolve(node.lines);
    return fetch(node.url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (t) { node.lines = t.replace(/\n$/, '').split('\n'); return node.lines; });
  }

  function copyText(text) {
    var n = text.length;
    return navigator.clipboard.writeText(text).then(function () {
      return [T('Copied ' + n + ' characters to the clipboard.', '已复制 ' + n + ' 个字符到剪贴板。')];
    }, function () {
      return [T('Copy failed: the browser blocked clipboard access. Select the text and press Ctrl/Cmd+C instead.',
                '复制失败：浏览器拒绝访问剪贴板。请选中文字后按 Ctrl/Cmd+C。')];
    });
  }

  var COMMANDS = {
    help: function () {
      var rows = [
        ['ls [dir]', T('list files', '列出文件')],
        ['cd <dir>', T('change directory (cd .. / cd ~)', '切换目录（cd .. / cd ~）')],
        ['cat <file>', T('print a file', '显示文件内容')],
        ['open <file>', T('open a page or the CV', '打开页面或简历')],
        ['copy <file>', T('copy a file to the clipboard (or: copy email)', '复制文件到剪贴板（或 copy email）')],
        ['tree', T('show all files', '显示全部文件')],
        ['pwd', T('print the current directory', '显示当前目录')],
        ['whoami', T('who is this?', '我是谁')],
        ['news / pubs / honors', T('shortcuts for the matching files', '对应文件的快捷方式')],
        ['contact / hire', T('how to reach me / start an email', '联系方式 / 直接写邮件')],
        ['cv / demo', T('open the CV / the prompt-injection demo', '打开简历 / 提示注入演示')],
        ['theme / lang', T('light-dark mode / English-中文', '切换深浅色 / 中英文')],
        ['history / clear / exit', T('past commands / clear screen / close', '历史命令 / 清屏 / 关闭')]
      ];
      return [T('Available commands:', '可用命令：')].concat(rows.map(function (r) { return '  ' + r[0].padEnd(24) + r[1]; }), ['',
        T('Tip: press Tab to complete, click any name in `ls` to open it.', '提示：按 Tab 自动补全；点击 `ls` 列出的名字即可打开。')]);
    },
    ls: function (args) {
      var path = args.filter(function (a) { return a[0] !== '-'; })[0] || '';
      var r = lookup(path);
      if (!r.node) return notFound('ls', path);
      if (r.node.type !== 'dir') return [path];
      printEntries(entries(r.node), r.parts.length ? pathStr(r.parts) : '');
      return [];
    },
    cd: function (args) {
      var path = args[0] || '~';
      var r = path === '-' ? { node: resolve('~/' + prevCwd.join('/')).node, parts: prevCwd } : lookup(path);
      if (!r.node) return notFound('cd', path);
      if (r.node.type !== 'dir') return ['cd: ' + path + T(': Not a directory', '：不是目录')];
      prevCwd = cwd;
      cwd = r.parts;
      setPrompt();
      return [];
    },
    pwd: function () { return [pathStr(cwd)]; },
    cat: function (args) {
      if (!args[0]) return [T('usage: cat <file>   (try: ls)', '用法：cat <文件>（先试试 ls）')];
      var path = args[0];
      if (/^f1?ag/i.test(path.replace(/.*\//, ''))) return ['cat: ' + path + T(': No such file. Real hackers read robots.txt.', '：没有这个文件。真正的黑客会去读 robots.txt。')];
      var r = lookup(path);
      if (!r.node) return notFound('cat', path);
      if (r.node.type === 'dir') return ['cat: ' + path + T(': Is a directory. Try `ls ' + path + '` or `cd ' + path + '`.', '：这是一个目录。试试 `ls ' + path + '` 或 `cd ' + path + '`。')];
      if (r.node.type === 'remote') return r.node.lines || load(r.node).catch(function () { return ['cat: ' + path + T(': could not load', '：加载失败')]; });
      if (r.node.url && /\.pdf$/.test(r.node.url)) { window.open(r.node.url, '_blank'); return [T('Opening ', '正在打开 ') + path + ' ...']; }
      return r.node.lines;
    },
    open: function (args) {
      if (!args[0]) return [T('usage: open <file>   e.g. open cv.pdf', '用法：open <文件>，例如 open cv.pdf')];
      var r = lookup(args[0]);
      if (!r.node) return notFound('open', args[0]);
      if (r.node.type === 'dir') { prevCwd = cwd; cwd = r.parts; setPrompt(); return COMMANDS.ls([]); }
      if (r.node.url) { window.open(r.node.url, '_blank'); return [T('Opening ', '正在打开 ') + r.node.url + ' ...']; }
      return r.node.lines;
    },
    copy: function (args) {
      var what = args[0];
      if (!what) return [T('usage: copy <file>   e.g. copy publications/autoguard.bib, copy email', '用法：copy <文件>，例如 copy publications/autoguard.bib 或 copy email')];
      if (what === 'email') return copyText(EMAIL);
      var r = lookup(what);
      if (!r.node) return notFound('copy', what);
      if (r.node.type === 'dir') return ['copy: ' + what + T(': Is a directory', '：这是一个目录')];
      if (r.node.type === 'remote' && !r.node.lines) return load(r.node).then(function () { return copyText(contentOf(r.node)); });
      return copyText(contentOf(r.node));
    },
    tree: function () {
      var lines = ['~'];
      (function walk(node, prefix) {
        var names = Object.keys(node.children);
        names.forEach(function (n, i) {
          var last = i === names.length - 1, child = node.children[n];
          lines.push(prefix + (last ? '└── ' : '├── ') + n + (child.type === 'dir' ? '/' : ''));
          if (child.type === 'dir') walk(child, prefix + (last ? '    ' : '│   '));
        });
      })(FS, '');
      return lines;
    },
    whoami: function () { return resolve('~/about.txt').node.lines.slice(0, 3); },
    news: function () { return COMMANDS.cat(['~/news.txt']); },
    pubs: function () {
      var dir = resolve('~/publications').node, lines = [];
      Object.keys(dir.children).filter(function (n) { return /\.txt$/.test(n); }).forEach(function (n, i) {
        if (i) lines.push('', '----', '');
        lines = lines.concat(dir.children[n].lines);
      });
      return lines;
    },
    honors: function () { return COMMANDS.cat(['~/honors.txt']); },
    contact: function () { return COMMANDS.cat(['~/contact.txt']); },
    email: function () { return COMMANDS.cat(['~/contact.txt']); },
    hire: function () {
      window.location.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('Research internship');
      return [T('Great choice. Opening your mail client ...', '好选择！正在打开邮件客户端……')];
    },
    cv: function () { return COMMANDS.cat(['~/cv.pdf']); },
    demo: function () { window.location.href = zh ? '/zh/demo/' : '/demo/'; return [T('Opening the demo ...', '正在打开演示……')]; },
    theme: function () { document.getElementById('theme-toggle').click(); return [T('Theme switched.', '已切换深浅色。')]; },
    lang: function () { window.location.href = zh ? '/' : '/zh/'; return [T('Switching language ...', '正在切换语言……')]; },
    history: function () { return history.map(function (h, i) { return String(i + 1).padStart(4) + '  ' + h; }); },
    echo: function (args) { return [args.join(' ')]; },
    sudo: function () { return [T('visitor is not in the sudoers file. This incident will be reported.', 'visitor 不在 sudoers 文件中。此事件将被报告。')]; },
    rm: function () { return [T('rm: permission denied. Nice try.', 'rm：权限不足。想得美。')]; },
    flag: function () { return [T('No flag here. Crawlers know where not to go.', '这里没有 flag。爬虫知道哪里不该去。')]; },
    clear: function () { out.innerHTML = ''; return []; },
    exit: function () { close(); return []; }
  };

  function exec(raw) {
    var lineText = raw.trim();
    if (!lineText) return;
    var parts = lineText.split(/\s+/);
    var cmd = parts[0].toLowerCase();
    var fn = COMMANDS[cmd];
    if (!fn) {
      var guess = closest(cmd, Object.keys(COMMANDS));
      print([cmd + T(': command not found. Type `help`.', '：没有这个命令。输入 `help` 查看。')].concat(
        guess ? [T('Did you mean `' + guess + '`?', '你是不是想输入 `' + guess + '`？')] : []), 'term-err');
      return;
    }
    var res = fn(parts.slice(1));
    if (res && typeof res.then === 'function') res.then(function (l) { print(l); });
    else print(res);
  }

  // supports simple `a && b` chains (used by clickable directory names)
  function run(raw) {
    line(setPrompt() + ' ' + raw, 'term-echo');
    if (raw.trim() && history[history.length - 1] !== raw.trim()) history.push(raw.trim());
    hIdx = history.length;
    raw.split('&&').forEach(function (part) { exec(part); });
    setPrompt();
    scroll();
  }

  // ---------- completion and inline hints ----------
  function candidates(value) {
    var space = value.lastIndexOf(' ');
    if (space < 0) {
      return { head: '', token: value, list: Object.keys(COMMANDS).filter(function (c) { return c.indexOf(value) === 0; }), cmd: true };
    }
    var cmd = value.split(/\s+/)[0].toLowerCase();
    var token = value.slice(space + 1);
    var head = value.slice(0, space + 1);
    if (!PATH_CMDS[cmd]) return { head: head, token: token, list: [] };
    var slash = token.lastIndexOf('/');
    var dirPart = slash >= 0 ? token.slice(0, slash + 1) : '';
    var base = slash >= 0 ? token.slice(slash + 1) : token;
    var parent = resolve(dirPart || '').node;
    if (!parent || parent.type !== 'dir') return { head: head, token: token, list: [] };
    var list = entries(parent, cmd === 'cd').filter(function (n) { return n.indexOf(base) === 0; });
    // nothing here: offer names from other folders (lookup() finds them)
    if (!list.length && !dirPart && base) list = basenames(cmd === 'cd').filter(function (n) { return n.indexOf(base) === 0; });
    if (cmd === 'copy' && !dirPart && 'email'.indexOf(base) === 0) list.push('email');
    return { head: head + dirPart, token: base, list: list, dir: dirPart };
  }

  function commonPrefix(list) {
    return list.reduce(function (a, b) { var i = 0; while (i < a.length && a[i] === b[i]) i++; return a.slice(0, i); });
  }

  function hint(value) {
    if (!value) return '';
    var c = candidates(value);
    if (c.list.length === 1) return c.list[0].slice(c.token.length) + (c.cmd ? ' ' : '');
    if (c.list.length > 1) return commonPrefix(c.list).slice(c.token.length);
    for (var i = history.length - 1; i >= 0; i--) {
      if (history[i].indexOf(value) === 0 && history[i] !== value) return history[i].slice(value.length);
    }
    return '';
  }

  function updateGhost() {
    ghostTyped.textContent = input.value;
    ghostRest.textContent = input.selectionStart === input.value.length ? hint(input.value) : '';
  }

  function complete() {
    var rest = ghostRest.textContent;
    var c = candidates(input.value);
    if (c.list.length > 1 && !rest) {
      line(setPrompt() + ' ' + input.value, 'term-echo');
      printEntries(c.list, c.dir ? c.dir.replace(/\/$/, '') : '', c.head);
    } else if (rest) {
      input.value += rest;
    }
    updateGhost();
  }

  function onKey(e) {
    if (e.key === 'Enter') { run(input.value); input.value = ''; updateGhost(); }
    else if (e.key === 'Tab') { e.preventDefault(); complete(); }
    else if (e.key === 'ArrowRight' && input.selectionStart === input.value.length && ghostRest.textContent) {
      e.preventDefault(); input.value += ghostRest.textContent; updateGhost();
    }
    else if (e.key === 'ArrowUp') { if (hIdx > 0) { hIdx--; input.value = history[hIdx]; } e.preventDefault(); updateGhost(); }
    else if (e.key === 'ArrowDown') { if (hIdx < history.length) { hIdx++; input.value = history[hIdx] || ''; } e.preventDefault(); updateGhost(); }
    else if (e.key === 'Escape') { close(); }
    else if ((e.key === 'l' || e.key === 'L') && e.ctrlKey) { e.preventDefault(); out.innerHTML = ''; }
    else if ((e.key === 'c' || e.key === 'C') && e.ctrlKey && !window.getSelection().toString() && input.selectionStart === input.selectionEnd) {
      e.preventDefault(); line(setPrompt() + ' ' + input.value + '^C', 'term-echo'); input.value = ''; updateGhost(); scroll();
    }
  }

  // ---------- window ----------
  function build() {
    FS = buildFS();
    overlay = document.createElement('div');
    overlay.className = 'term';
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="term-window" role="dialog" aria-modal="true" aria-label="Terminal">' +
        '<div class="term-bar"><span class="term-dots"><i></i><i></i><i></i></span>' +
        '<span class="term-title">visitor@wentao: ~</span>' +
        '<button type="button" class="term-close" aria-label="Close terminal">&times;</button></div>' +
        '<div class="term-body"><div class="term-out" aria-live="polite"></div>' +
        '<div class="term-line"><span class="term-prompt"></span>' +
          '<span class="term-field"><span class="term-ghost" aria-hidden="true"><span class="term-ghost-typed"></span><span class="term-ghost-rest"></span></span>' +
          '<input class="term-input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Command"></span></div></div>' +
        '<div class="term-hints">' + T('Tab complete · → accept hint · ↑↓ history · click a name to open · select text to copy · Esc close',
                                        'Tab 补全 · → 接受提示 · ↑↓ 历史命令 · 点击名字打开 · 选中文字即可复制 · Esc 关闭') + '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    out = overlay.querySelector('.term-out');
    input = overlay.querySelector('.term-input');
    promptEl = overlay.querySelector('.term-prompt');
    titleEl = overlay.querySelector('.term-title');
    ghostTyped = overlay.querySelector('.term-ghost-typed');
    ghostRest = overlay.querySelector('.term-ghost-rest');
    overlay.querySelector('.term-close').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    // focus the prompt on click, but never while the visitor is selecting text to copy
    overlay.querySelector('.term-body').addEventListener('click', function (e) {
      if (window.getSelection().toString() || e.target.closest('button')) return;
      input.focus();
    });
    ghostRest.addEventListener('click', function () { input.value += ghostRest.textContent; updateGhost(); input.focus(); });
    input.addEventListener('keydown', onKey);
    input.addEventListener('input', updateGhost);
    input.addEventListener('click', updateGhost);
    input.addEventListener('keyup', function (e) { if (/^Arrow(Left|Right)|Home|End$/.test(e.key)) updateGhost(); });
    allPaths().forEach(function (e) { if (e.node.type === 'remote') load(e.node).catch(function () {}); });
    setPrompt();
    if (window.WENTAO_BANNER) print(window.WENTAO_BANNER.split('\n'), 'term-banner');
    print([T('Welcome. Type `help` to see what you can do here, or start with `ls`.', '欢迎！输入 `help` 查看可用命令，或者先输入 `ls`。'), '']);
  }

  function open() {
    if (!overlay) build();
    lastFocus = document.activeElement;
    overlay.hidden = false;
    document.documentElement.classList.add('term-open');
    input.focus();
    updateGhost();
  }

  function close() {
    if (!overlay) return;
    overlay.hidden = true;
    document.documentElement.classList.remove('term-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  var btn = document.getElementById('term-toggle');
  if (btn) btn.addEventListener('click', function () { overlay && !overlay.hidden ? close() : open(); });
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (e.key === '`' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); open(); }
  });
})();
