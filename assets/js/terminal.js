// Terminal mode: press ` (backquote) or click >_ in the top bar.
(function () {
  var EMAIL = 'shangwentao3@outlook.com';
  var CV = '/assets/cv/Wentao_Shang_CV.pdf';
  var zhPage = document.documentElement.lang.indexOf('zh') === 0;

  var FILES = {
    'about.txt': [
      'Wentao (Donald) Shang  |  尚文韬',
      'Doctoral student (D.Eng.), School of Computer Science and Engineering, Sun Yat-sen University',
      'Joint doctoral student & research assistant, Pengcheng Laboratory',
      'B.Eng. in Information Security, Beijing Jiaotong University (2024)'
    ],
    'research.txt': [
      '[current]  Security of LLM-based agents',
      '           Agents read untrusted content and act through tools, so injected',
      '           instructions can steer them. How do these attacks work in practice,',
      '           and how do we detect and stop them?',
      '',
      '[previous] In-vehicle network security',
      '           Lightweight cross-layer intrusion detection for Automotive Ethernet.'
    ],
    'contact.txt': [
      'email     ' + EMAIL,
      'status    open to research internships in AI & agent security',
      'tip       type `hire` to start an email'
    ]
  };

  var COMMANDS = {
    help: function () {
      return [
        'Available commands:',
        '  whoami          who is this?',
        '  ls              list files',
        '  cat <file>      print a file',
        '  pubs            publications',
        '  honors          honors and awards',
        '  contact         how to reach me',
        '  hire            start an internship email',
        '  cv              open the CV (PDF)',
        '  demo            30-second prompt-injection demo',
        '  theme           toggle light / dark',
        '  lang            switch English / 中文',
        '  clear           clear the screen',
        '  exit            close the terminal'
      ];
    },
    whoami: function () { return FILES['about.txt']; },
    ls: function () { return [Object.keys(FILES).join('    ') + '    publications/    cv.pdf']; },
    cat: function (args) {
      var f = (args[0] || '').replace(/^\.\//, '');
      if (!f) return ['usage: cat <file>'];
      if (f === 'cv.pdf') { window.open(CV, '_blank'); return ['Opening cv.pdf ...']; }
      if (f === 'flag' || f === 'flag.txt') return ['cat: ' + f + ': No such file. Real hackers read robots.txt.'];
      return FILES[f] || ['cat: ' + f + ': No such file or directory'];
    },
    pubs: function () {
      return [
        '[J1] AutoGuard: Unified and Lightweight Cross-Layer Intrusion Detection',
        '     for Automotive Ethernet via Contextual Traffic Analysis',
        '     W. Shang, S. Jin, W. Han. Computer Networks 286, 112394 (2026)',
        '     https://doi.org/10.1016/j.comnet.2026.112394',
        '     project page: ' + (zhPage ? '/zh/autoguard/' : '/autoguard/')
      ];
    },
    honors: function () {
      return [
        '2023  BJTU Elite Award (top 6 students university-wide)',
        '2023  Third Prize, 16th National Cybersecurity Competition',
        '2022  Global Runner-up (team), DEF CON 30 BCTF AutoDriving CTF'
      ];
    },
    contact: function () { return FILES['contact.txt']; },
    email: function () { return FILES['contact.txt']; },
    hire: function () {
      window.location.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('Research internship');
      return ['Great choice. Opening your mail client ...'];
    },
    cv: function () { window.open(CV, '_blank'); return ['Opening cv.pdf ...']; },
    demo: function () { window.location.href = zhPage ? '/zh/demo/' : '/demo/'; return ['Opening the demo ...']; },
    theme: function () { document.getElementById('theme-toggle').click(); return ['Theme switched.']; },
    lang: function () { window.location.href = zhPage ? '/' : '/zh/'; return ['Switching language ...']; },
    sudo: function () { return ['visitor is not in the sudoers file. This incident will be reported.']; },
    rm: function () { return ['rm: permission denied. Nice try.']; },
    flag: function () { return ['No flag here. Crawlers know where not to go.']; },
    clear: function () { out.innerHTML = ''; return []; },
    exit: function () { close(); return []; }
  };

  var overlay, out, input, history = [], hIdx = 0, lastFocus;

  function build() {
    overlay = document.createElement('div');
    overlay.className = 'term';
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="term-window" role="dialog" aria-modal="true" aria-label="Terminal">' +
        '<div class="term-bar"><span class="term-dots"><i></i><i></i><i></i></span>' +
        '<span class="term-title">visitor@wentao: ~</span>' +
        '<button type="button" class="term-close" aria-label="Close terminal">&times;</button></div>' +
        '<div class="term-body"><div class="term-out" aria-live="polite"></div>' +
        '<label class="term-line"><span class="term-prompt">visitor@wentao:~$</span>' +
        '<input class="term-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Command"></label></div>' +
      '</div>';
    document.body.appendChild(overlay);
    out = overlay.querySelector('.term-out');
    input = overlay.querySelector('.term-input');
    overlay.querySelector('.term-close').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    overlay.querySelector('.term-body').addEventListener('click', function () { input.focus(); });
    input.addEventListener('keydown', onKey);
    print(window.WENTAO_BANNER ? window.WENTAO_BANNER.split('\n') : [], null, 'term-banner');
    print(['Welcome. Type `help` to see what you can do here.' + (zhPage ? '  （输入 help 查看命令）' : ''), '']);
  }

  function print(lines, pre, cls) {
    (pre || []).concat(lines).forEach(function (l) {
      var div = document.createElement('div');
      if (cls) div.className = cls;
      div.textContent = l === '' ? ' ' : l;
      out.appendChild(div);
    });
    out.parentNode.scrollTop = out.parentNode.scrollHeight;
  }

  function exec(raw) {
    var line = raw.trim();
    var echo = document.createElement('div');
    echo.className = 'term-echo';
    echo.textContent = 'visitor@wentao:~$ ' + raw;
    out.appendChild(echo);
    if (!line) return;
    history.push(line);
    hIdx = history.length;
    var parts = line.split(/\s+/);
    var cmd = parts[0].toLowerCase();
    var fn = COMMANDS[cmd];
    print(fn ? fn(parts.slice(1)) : [cmd + ': command not found. Type `help`.']);
  }

  function complete() {
    var v = input.value;
    var parts = v.split(/\s+/);
    var pool = parts.length > 1 ? Object.keys(FILES).concat(['cv.pdf']) : Object.keys(COMMANDS);
    var cur = parts[parts.length - 1];
    var hits = pool.filter(function (x) { return x.indexOf(cur) === 0; });
    if (hits.length === 1) { parts[parts.length - 1] = hits[0]; input.value = parts.join(' ') + (parts.length === 1 ? ' ' : ''); }
    else if (hits.length > 1) { print([hits.join('    ')]); }
  }

  function onKey(e) {
    if (e.key === 'Enter') { exec(input.value); input.value = ''; }
    else if (e.key === 'ArrowUp') { if (hIdx > 0) { hIdx--; input.value = history[hIdx]; } e.preventDefault(); }
    else if (e.key === 'ArrowDown') { if (hIdx < history.length) { hIdx++; input.value = history[hIdx] || ''; } e.preventDefault(); }
    else if (e.key === 'Tab') { complete(); e.preventDefault(); }
    else if (e.key === 'Escape') { close(); }
    else if (e.key === 'l' && e.ctrlKey) { out.innerHTML = ''; e.preventDefault(); }
  }

  function open() {
    if (!overlay) build();
    lastFocus = document.activeElement;
    overlay.hidden = false;
    document.documentElement.classList.add('term-open');
    input.focus();
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
