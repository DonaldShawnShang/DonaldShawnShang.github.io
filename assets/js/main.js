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
