// Prompt-injection demo: a scripted agent trace. All text lives in the page HTML.
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('[data-demo]').forEach(function (demo) {
    var runBtn = demo.querySelector('[data-run]');
    var guard = demo.querySelector('[data-guard]');
    var reveal = demo.querySelector('[data-reveal]');
    var idle = demo.querySelector('[data-idle]');
    var steps = Array.prototype.slice.call(demo.querySelectorAll('[data-step]'));
    var timers = [];
    var started = false;

    function setReveal(on) {
      demo.classList.toggle('is-revealed', on);
      reveal.checked = on;
    }

    function run() {
      started = true;
      timers.forEach(clearTimeout);
      timers = [];
      steps.forEach(function (s) { s.hidden = true; });
      idle.hidden = true;
      setReveal(false);
      var mode = guard.checked ? 'on' : 'off';
      steps
        .filter(function (s) { return !s.dataset.when || s.dataset.when === mode; })
        .forEach(function (s, i) {
          timers.push(setTimeout(function () {
            s.hidden = false;
            if (s.hasAttribute('data-reveal-here')) setReveal(true);
          }, reduce ? 0 : 150 + i * 800));
        });
    }

    reveal.addEventListener('change', function () { setReveal(reveal.checked); });
    guard.addEventListener('change', function () { if (started) run(); });
    runBtn.addEventListener('click', run);
  });
})();

// The demo sits in a collapsed <details>; open it when the URL points at #demo
(function () {
  var panel = document.getElementById('demo');
  if (!panel || panel.tagName !== 'DETAILS') return;
  function openIfTargeted() { if (location.hash === '#demo') panel.open = true; }
  openIfTargeted();
  window.addEventListener('hashchange', openIfTargeted);
})();
