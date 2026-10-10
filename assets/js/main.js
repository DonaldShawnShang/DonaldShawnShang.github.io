// Shared by / (English) and /zh/ (Chinese).
(function () {
  var root = document.documentElement;

  // Light / dark toggle: defaults to the system setting, choice remembered per browser
  var themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var dark = root.dataset.theme
        ? root.dataset.theme === 'dark'
        : window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.dataset.theme = dark ? 'light' : 'dark';
      try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
    });
  }

  // BibTeX toggle + copy
  document.querySelectorAll('[data-bib]').forEach(function (btn) {
    var box = document.getElementById(btn.dataset.bib);
    btn.addEventListener('click', function () {
      box.hidden = !box.hidden;
      btn.setAttribute('aria-expanded', String(!box.hidden));
    });
    var copy = box.querySelector('.copy');
    copy.addEventListener('click', function () {
      navigator.clipboard.writeText(box.querySelector('pre').textContent).then(function () {
        var label = copy.textContent;
        copy.textContent = copy.dataset.done;
        setTimeout(function () { copy.textContent = label; }, 1500);
      });
    });
  });

  // Highlight the nav link of the section in view
  var links = {};
  document.querySelectorAll('.nav a[href^="#"]').forEach(function (a) {
    links[a.getAttribute('href').slice(1)] = a;
  });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        Object.values(links).forEach(function (a) { a.classList.remove('is-active'); });
        if (links[entry.target.id]) links[entry.target.id].classList.add('is-active');
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    document.querySelectorAll('main > section[id]').forEach(function (s) { io.observe(s); });
  }
})();

// Console greeting for people who open DevTools
(function () {
  var banner = window.WENTAO_BANNER = "__        __              _\n\\ \\      / /  ___  _ __  | |_   __ _   ___\n \\ \\ /\\ / /  / _ \\| '_ \\ | __| / _` | / _ \\\n  \\ V  V /  |  __/| | | || |_ | (_| || (_) |\n   \\_/\\_/    \\___||_| |_| \\__| \\__,_| \\___/";
  try {
    console.log('%c' + banner, 'font-family: ui-monospace, Menlo, monospace; color: #1b5fad; font-weight: bold;');
    console.log(
      '%cHi there. You opened the console, so you probably like looking under the hood.\n' +
      'I study how AI agents get hijacked, and I am looking for research internships in AI & agent security.\n' +
      'Say hi: shangwentao3@outlook.com\n\n' +
      '你好！我研究 AI Agent 如何被劫持，正在寻找 AI / 智能体安全方向的研究实习。\n\n' +
      'P.S. A flag is hidden on this site. Crawlers know where not to go.  /  本站藏了一个 flag。',
      'font-family: ui-monospace, Menlo, monospace; line-height: 1.6;'
    );
  } catch (e) {}
})();
