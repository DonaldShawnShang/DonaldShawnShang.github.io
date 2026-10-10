// AutoGuard project page: animated pipeline + hex-bigram tokenizer playground.
// Text that belongs to the page lives in the HTML; this file only holds the
// example traffic and a few short labels (English / Chinese).
(function () {
  var lang = document.documentElement.lang.indexOf('zh') === 0 ? 'zh' : 'en';
  function T(en, zh) { return lang === 'zh' ? zh : en; }
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function chip(cls, text) {
    var s = document.createElement('span');
    s.className = cls;
    s.textContent = text;
    return s;
  }

  // Overlapping byte bigrams, each written as four hex digits (Eq. 7 in the paper)
  function bigrams(bytes) {
    var out = [];
    for (var i = 0; i + 1 < bytes.length; i++) out.push(bytes[i] + bytes[i + 1]);
    return out;
  }

  // ---------- tokenizer playground ----------
  var lab = document.querySelector('[data-tok]');
  if (lab) {
    var input = lab.querySelector('[data-tok-input]');
    var outEl = lab.querySelector('[data-tok-out]');
    var msg = lab.querySelector('[data-tok-msg]');

    var parse = function (text) {
      var clean = text.toLowerCase().replace(/0x/g, '').replace(/[\s,:;\-_]/g, '');
      if (!clean) return { bytes: [] };
      if (/[^0-9a-f]/.test(clean)) return { error: T('Use hex digits only (0–9, a–f).', '只能输入十六进制字符（0–9、a–f）。') };
      if (clean.length % 2) return { error: T('Odd number of hex digits: every byte needs two.', '十六进制位数为奇数：每个字节需要两位。') };
      var bytes = clean.match(/../g);
      return { bytes: bytes.slice(0, 64), truncated: bytes.length > 64 };
    };

    var render = function () {
      var r = parse(input.value);
      outEl.innerHTML = '';
      msg.classList.toggle('is-error', !!r.error);
      if (r.error) { msg.textContent = r.error; return; }
      if (!r.bytes.length) { msg.textContent = T('Type some bytes, e.g. 12 34 00 01.', '请输入字节，例如 12 34 00 01。'); return; }
      var toks = bigrams(r.bytes);
      outEl.appendChild(chip('ag-tok is-special', '[CLS]'));
      toks.forEach(function (t) { outEl.appendChild(chip('ag-tok', t)); });
      outEl.appendChild(chip('ag-tok is-special', '[SEP]'));
      var L = r.bytes.length;
      msg.textContent = T('L = ' + L + ' bytes → m = L − 1 = ' + toks.length + ' tokens',
                          'L = ' + L + ' 字节 → m = L − 1 = ' + toks.length + ' 个词元') +
        (r.truncated ? T(' (showing the first 64 bytes)', '（只显示前 64 个字节）') : '');
    };
    input.addEventListener('input', render);
    render();
  }

  // ---------- animated pipeline ----------
  var root = document.querySelector('[data-ag]');
  if (!root) return;

  var PROTO = { som: 'SOME/IP', can: 'CAN/UDP', avtp: 'AVTP', ptp: 'gPTP' };
  var PROTO_SHORT = { som: 'SOME', can: 'CAN', avtp: 'AVTP', ptp: 'PTP' };
  var narrow = window.matchMedia('(max-width: 520px)');
  var HEADER = { som: 'ETH·IPv4·UDP', can: 'ETH·IPv4·UDP', avtp: 'ETH', ptp: 'ETH' };
  var NOTE = {
    req: T('SOME/IP request (type 0x00)', 'SOME/IP 请求（类型 0x00）'),
    resp: T('SOME/IP response (type 0x80)', 'SOME/IP 响应（类型 0x80）'),
    can: T('CAN frame, ID 0x1A4', 'CAN 帧，ID 0x1A4'),
    can2: T('CAN frame, ID 0x210', 'CAN 帧，ID 0x210'),
    avtp: T('audio stream data', '音频流数据'),
    sync: T('gPTP Sync message', 'gPTP 同步报文'),
    replay: T('identical to an earlier frame: replayed', '与前一帧完全相同：重放'),
    orphan: T('response with no request in the window', '窗口内没有对应请求的响应')
  };
  // Label space of the combined dataset: Normal + 11 attack types
  var CLASSES = ['Normal', 'Frame Injection', 'gPTP Sync Attack', 'MAC Flooding', 'CAN-over-UDP DoS',
    'CAN-over-UDP Replay', 'Burst Attack', 'Complex Attack', 'Request Without Response',
    'Response Without Request', 'Error On Error', 'Error On Event'];

  // Example packets (made-up bytes; transport-layer payload only)
  var P = {
    req:  { p: 'som',  b: '12 34 00 01 01 01 00 00', n: 'req' },
    resp: { p: 'som',  b: '12 34 00 01 01 01 80 00', n: 'resp' },
    can:  { p: 'can',  b: '00 00 01 a4 08 3c 7f 00', n: 'can' },
    can2: { p: 'can',  b: '00 00 02 10 08 11 00 4f', n: 'can2' },
    avtp: { p: 'avtp', b: '02 81 00 2b 9c 1e', n: 'avtp' },
    sync: { p: 'ptp',  b: '10 02 00 2c 00 00', n: 'sync' }
  };
  function variant(base, extra) { return Object.assign({}, base, extra); }
  var orphan = variant(P.resp, { b: '56 78 80 01 01 01 80 00', ev: 'orphan' });
  var replayed = variant(P.can, { ev: 'replay' });

  // Nine packets on the wire; the window covers packets 3–7 (w = 5)
  var SCEN = {
    normal: { cls: 0, stream: [P.sync, P.avtp, P.req, P.can, P.avtp, P.resp, P.sync, P.can2, P.avtp] },
    replay: { cls: 5, stream: [P.avtp, P.sync, P.can, P.avtp, replayed, replayed, P.sync, P.req, P.avtp] },
    rwr:    { cls: 9, stream: [P.avtp, P.can2, P.sync, orphan, P.avtp, orphan, P.can2, P.sync, P.avtp] }
  };
  var WIN_START = 2, W = 5;

  function q(sel) { return root.querySelector(sel); }
  var track = q('[data-track]'), packets = q('[data-packets]'), bytesEl = q('[data-bytes]'),
      bytesCount = q('[data-bytes-count]'), tokensEl = q('[data-tokens]'), tokCount = q('[data-tok-count]'),
      seqEl = q('[data-seq]'), layersEl = q('[data-layers]'), hEl = q('[data-h]'),
      classesEl = q('[data-classes]'), caption = q('[data-caption]'), evNote = q('[data-evidence-note]');
  var rows = root.querySelectorAll('[data-row]');
  var stepLabels = root.querySelectorAll('[data-step-label]');
  var caps = root.querySelectorAll('[data-cap]');
  var btnPlay = q('[data-play]'), btnNext = q('[data-next]'), btnReset = q('[data-reset]');
  var scenBtns = root.querySelectorAll('[data-scenario]');

  for (var i = 0; i < 12; i++) layersEl.appendChild(document.createElement('i'));
  CLASSES.forEach(function (c) { classesEl.appendChild(chip('ag-pill', c)); });

  var scen = 'normal', step = 0, busy = false, playing = false, run = 0;

  function sleep(ms) {
    var my = run;
    return new Promise(function (resolve, reject) {
      setTimeout(function () { if (my === run) resolve(); else reject('cancelled'); }, reduce ? 0 : ms);
    });
  }

  function sync() {
    btnPlay.disabled = busy || playing;
    btnNext.disabled = busy || playing || step >= 5;
  }

  function setStep(k) {
    step = k;
    rows.forEach(function (r) {
      var n = +r.dataset.row;
      r.classList.toggle('is-active', n === k);
      r.classList.toggle('is-done', n < k);
    });
    stepLabels.forEach(function (li) {
      var n = +li.dataset.stepLabel;
      li.classList.toggle('is-active', n === k);
      li.classList.toggle('is-done', n < k);
    });
    caption.textContent = caps[k].textContent;
  }

  function windowPackets() { return SCEN[scen].stream.slice(WIN_START, WIN_START + W); }

  function reset() {
    run++;
    busy = false;
    playing = false;
    track.innerHTML = '';
    packets.innerHTML = '';
    bytesEl.innerHTML = '';
    tokensEl.innerHTML = '';
    bytesCount.textContent = '';
    tokCount.textContent = '';
    seqEl.textContent = '';
    layersEl.querySelectorAll('i').forEach(function (b) { b.classList.remove('is-on'); });
    hEl.classList.remove('is-on');
    root.querySelectorAll('[data-bin]').forEach(function (p) { p.className = 'ag-pill'; });
    classesEl.querySelectorAll('.ag-pill').forEach(function (p) { p.className = 'ag-pill'; });
    evNote.hidden = true;
    var names = narrow.matches ? PROTO_SHORT : PROTO;
    SCEN[scen].stream.forEach(function (p) {
      var c = chip('ag-chip ag-p-' + p.p, names[p.p]);
      c.title = PROTO[p.p];
      track.appendChild(c);
    });
    var br = document.createElement('div');
    br.className = 'ag-bracket';
    br.hidden = true;
    br.appendChild(chip('', 'w = 5'));
    track.appendChild(br);
    setStep(0);
    sync();
  }

  // ① slide the window (stride 1) until it covers the example packets
  async function stage1() {
    var br = track.querySelector('.ag-bracket');
    var chips = track.querySelectorAll('.ag-chip');
    br.style.setProperty('--i', 0);
    br.hidden = false;
    await sleep(500);
    for (var i = 1; i <= WIN_START; i++) {
      br.style.setProperty('--i', i);
      await sleep(600);
    }
    chips.forEach(function (c, k) { c.classList.toggle('in-window', k >= WIN_START && k < WIN_START + W); });
    await sleep(300);
  }

  // ② drop headers, keep payloads, concatenate in time order
  async function stage2() {
    var list = windowPackets().map(function (p) {
      var row = document.createElement('div');
      row.className = 'ag-pkt ag-p-' + p.p;
      row.appendChild(chip('ag-pkt-tag', PROTO[p.p]));
      row.appendChild(chip('ag-hdr', HEADER[p.p]));
      row.appendChild(chip('ag-pl', p.b));
      row.appendChild(chip('ag-pkt-note', NOTE[p.n]));
      if (p.ev) row.dataset.ev = p.ev;
      row.hidden = true;
      packets.appendChild(row);
      return row;
    });
    for (var i = 0; i < list.length; i++) { list[i].hidden = false; await sleep(220); }
    await sleep(450);
    list.forEach(function (r) { r.classList.add('is-stripped'); });
    await sleep(650);
    var n = 0;
    var all = windowPackets();
    for (var k = 0; k < all.length; k++) {
      var bytes = all[k].b.split(' ');
      for (var j = 0; j < bytes.length; j++) {
        bytesEl.appendChild(chip('ag-byte ag-p-' + all[k].p, bytes[j]));
        n++;
        if (n % 2 === 0) await sleep(35);
      }
    }
    bytesCount.textContent = T('Concatenated payload B: L = ' + n + ' bytes (capped at L_max)',
                               '拼接后的载荷 B：L = ' + n + ' 字节（上限为 L_max）');
  }

  // ③ overlapping byte pairs become hex-bigram tokens
  async function stage3() {
    var chips = bytesEl.querySelectorAll('.ag-byte');
    var toks = bigrams(Array.prototype.map.call(chips, function (c) { return c.textContent; }));
    for (var t = 0; t < toks.length; t++) {
      chips[t].classList.add('is-pair');
      chips[t + 1].classList.add('is-pair');
      tokensEl.appendChild(chip('ag-tok', toks[t]));
      await sleep(t < 6 ? 480 : 55);
      chips[t].classList.remove('is-pair');
      chips[t + 1].classList.remove('is-pair');
    }
    tokCount.textContent = T('m = L − 1 = ' + toks.length + ' tokens (at most 512 positions with [CLS] and [SEP])',
                             'm = L − 1 = ' + toks.length + ' 个词元（加上 [CLS] 和 [SEP] 最多 512 个位置）');
  }

  // ④ wrap with [CLS] … [SEP] and run the 12-layer encoder
  async function stage4() {
    var toks = Array.prototype.map.call(tokensEl.querySelectorAll('.ag-tok'), function (c) { return c.textContent; });
    tokensEl.insertBefore(chip('ag-tok is-special', '[CLS]'), tokensEl.firstChild);
    tokensEl.appendChild(chip('ag-tok is-special', '[SEP]'));
    seqEl.textContent = '[CLS] ' + toks.slice(0, 3).join(' ') + ' … ' + toks[toks.length - 1] + ' [SEP]';
    await sleep(450);
    var bars = layersEl.querySelectorAll('i');
    for (var i = 0; i < bars.length; i++) { bars[i].classList.add('is-on'); await sleep(120); }
    await sleep(250);
    hEl.classList.add('is-on');
    await sleep(350);
  }

  // ⑤ shallow head: Normal vs. Attack, then which attack
  async function stage5() {
    var s = SCEN[scen];
    var attack = s.cls !== 0;
    var cls = attack ? 'is-attack' : 'is-normal';
    root.querySelector('[data-bin="' + (attack ? 'attack' : 'normal') + '"]').classList.add(cls);
    await sleep(450);
    classesEl.querySelectorAll('.ag-pill')[s.cls].classList.add(cls);
    if (!attack) return;
    await sleep(400);
    var chips = track.querySelectorAll('.ag-chip');
    s.stream.forEach(function (p, k) { if (p.ev && k >= WIN_START && k < WIN_START + W) chips[k].classList.add('is-evidence'); });
    packets.querySelectorAll('.ag-pkt').forEach(function (r) {
      if (!r.dataset.ev) return;
      r.classList.add('is-evidence');
      r.querySelector('.ag-pkt-note').textContent = NOTE[r.dataset.ev];
    });
    evNote.hidden = false;
  }

  var STAGES = [null, stage1, stage2, stage3, stage4, stage5];

  async function next(fromPlay) {
    if (busy || step >= 5 || (playing && !fromPlay)) return;
    busy = true;
    sync();
    var k = step + 1;
    setStep(k);
    await STAGES[k]();
    busy = false;
    sync();
  }

  async function play() {
    if (playing || busy) return;
    if (step >= 5) reset();
    playing = true;
    sync();
    var my = run;
    while (step < 5 && my === run) {
      await next(true);
      if (step < 5) await sleep(800);
    }
    if (my === run) { playing = false; sync(); }
  }

  function quiet(promise) { promise.catch(function (e) { if (e !== 'cancelled') throw e; }); }

  btnPlay.addEventListener('click', function () { quiet(play()); });
  btnNext.addEventListener('click', function () { quiet(next(false)); });
  btnReset.addEventListener('click', reset);
  scenBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      scen = b.dataset.scenario;
      scenBtns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      reset();
    });
  });

  reset();
})();
