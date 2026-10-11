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

  var PROTO = { som: 'SOME/IP', can: 'CAN/UDP', avtp: 'AVTP', ptp: 'gPTP', eth: 'Ethernet' };
  var PROTO_SHORT = { som: 'SOME', can: 'CAN', avtp: 'AVTP', ptp: 'PTP', eth: 'ETH' };
  var narrow = window.matchMedia('(max-width: 520px)');
  var HEADER = { som: 'ETH·IPv4·UDP', can: 'ETH·IPv4·UDP', avtp: 'ETH', ptp: 'ETH', eth: 'ETH' };

  // Label space of the combined dataset: Normal + 11 attack types (index = class id)
  var CLASSES = ['Normal', 'Frame Injection', 'gPTP Sync Attack', 'MAC Flooding', 'CAN-over-UDP DoS',
    'CAN-over-UDP Replay', 'Burst Attack', 'Complex Attack', 'Request Without Response',
    'Response Without Request', 'Error On Error', 'Error On Event'];

  // Example packets: made-up bytes, transport-layer payload only.
  // SOME/IP (shortened header): service, method/event, client, session, proto ver, iface ver, msg type, return code.
  function pk(p, b, en, zh, ev) { return { p: p, b: b, note: T(en, zh), ev: ev ? T(ev[0], ev[1]) : '' }; }
  var P = {
    req:    pk('som', '12 34 00 01 01 01 00 05 01 01 00 00', 'SOME/IP request, session 0x05', 'SOME/IP 请求，会话 0x05'),
    resp:   pk('som', '12 34 00 01 01 01 00 05 01 01 80 00', 'SOME/IP response, session 0x05', 'SOME/IP 响应，会话 0x05'),
    evt:    pk('som', '12 34 80 01 00 00 00 09 01 01 02 00', 'SOME/IP event 0x8001', 'SOME/IP 事件 0x8001'),
    can:    pk('can', '00 00 01 a4 08 3c 7f 00', 'CAN frame, ID 0x1A4', 'CAN 帧，ID 0x1A4'),
    can2:   pk('can', '00 00 02 10 08 11 00 4f', 'CAN frame, ID 0x210', 'CAN 帧，ID 0x210'),
    avtp:   pk('avtp', '02 81 00 2b 9c 1e', 'audio stream, seq 0x2b', '音频流，序号 0x2b'),
    avtp2:  pk('avtp', '02 81 00 2c 9c 21', 'audio stream, seq 0x2c', '音频流，序号 0x2c'),
    avtp3:  pk('avtp', '02 81 00 2d 9c 25', 'audio stream, seq 0x2d', '音频流，序号 0x2d'),
    sync:   pk('ptp', '10 02 00 2c 00 00', 'gPTP Sync', 'gPTP 同步报文'),
    fu:     pk('ptp', '18 02 00 2c 3b 9a', 'gPTP Follow_Up (timestamp)', 'gPTP 跟随报文（时间戳）')
  };
  function many(base, overrides) { return overrides.map(function (o) { return Object.assign({}, base, o); }); }

  var injected = pk('avtp', '02 81 00 2c ff ff', 'audio frame', '音频帧',
    ['forged frame: repeated seq 0x2c, junk samples', '伪造帧：序号 0x2c 重复，采样数据为乱码']);
  var fuForged = pk('ptp', '18 02 00 2c ff 7f', 'gPTP Follow_Up', 'gPTP 跟随报文',
    ['second Follow_Up for one Sync, timestamp jumps: forged', '同一 Sync 的第二个跟随报文，时间戳跳变：伪造']);
  var floods = many(pk('eth', '', 'Ethernet frame', '以太网帧',
    ['flood frame: spoofed source MAC, random payload', '泛洪帧：伪造源 MAC，随机载荷']),
    [{ b: '3f 9a 11 c2 7e 05' }, { b: 'a7 04 e9 5b 20 dd' }, { b: 'c1 6e 08 f3 9d 42' }, { b: '5e 21 b7 0a 64 e8' }]);
  var canDos = pk('can', '00 00 00 00 08 00 00 00', 'CAN frame, ID 0x000', 'CAN 帧，ID 0x000',
    ['ID 0x000 (top priority), empty data, again and again', 'ID 0x000（最高优先级）、空数据，反复出现']);
  var replayed = pk('can', '00 00 01 a4 08 3c 7f 00', 'CAN frame, ID 0x1A4', 'CAN 帧，ID 0x1A4',
    ['identical to an earlier frame: replayed', '与前一帧完全相同：重放']);
  var burst = many(pk('som', '', 'SOME/IP event 0x8001', 'SOME/IP 事件 0x8001',
    ['burst: the same event, back to back', '突发：同一事件连续出现']),
    [{ b: '12 34 80 01 00 00 00 0a 01 01 02 00' }, { b: '12 34 80 01 00 00 00 0b 01 01 02 00' },
     { b: '12 34 80 01 00 00 00 0c 01 01 02 00' }, { b: '12 34 80 01 00 00 00 0d 01 01 02 00' }]);
  var malformed = pk('som', '12 34 80 01 00 00 00 0a ff 01 02 00', 'SOME/IP event', 'SOME/IP 事件',
    ['malformed: protocol version 0xff', '格式错误：协议版本 0xff']);
  var mixed = pk('som', '12 34 80 01 00 00 00 0b 01 01 00 00', 'SOME/IP event', 'SOME/IP 事件',
    ['mixed: an event ID sent as a request', '类型混杂：事件 ID 以请求类型发送']);
  var corrupted = pk('som', 'de ad 80 01 00 00 00 0c 01 01 02 7f', 'SOME/IP event', 'SOME/IP 事件',
    ['corrupted: unknown service 0xdead, bad return code', '数据损坏：未知服务 0xdead，返回码异常']);
  var spoofReq = pk('som', '12 34 00 01 01 01 00 63 01 01 00 00', 'SOME/IP request', 'SOME/IP 请求',
    ['session 0x63 is out of order: sent by a spoofed client', '会话号 0x63 不连续：来自伪造的客户端']);
  var unaskedResp = pk('som', '12 34 00 01 01 01 00 63 01 01 80 00', 'SOME/IP response', 'SOME/IP 响应',
    ['response the real client never asked for', '真实客户端从未请求过的响应']);
  var fakeResp = pk('som', '56 78 00 01 01 01 00 2a 01 01 80 00', 'SOME/IP response', 'SOME/IP 响应',
    ['fake response: no request in the window', '伪造响应：窗口内没有对应请求']);
  var errOnEvent = pk('som', '12 34 80 01 01 01 00 09 01 01 81 01', 'SOME/IP error', 'SOME/IP 错误报文',
    ['error reply to an event: events are never answered', '对事件回复错误：事件本不需要回复']);
  var badReq = pk('som', '12 34 00 07 01 01 00 06 01 01 00 00', 'request for unknown method 0x0007', '请求未知方法 0x0007');
  var errMsg = pk('som', '12 34 00 07 01 01 00 06 01 01 81 03', 'error message, return code 0x03', '错误报文，返回码 0x03');
  var errOnErr = pk('som', '12 34 00 07 01 01 00 06 01 01 81 01', 'SOME/IP error', 'SOME/IP 错误报文',
    ['error reply to an error message', '对错误报文再回复错误']);

  // Each example: nine packets on the wire; the window covers packets 3–7 (w = 5).
  function S(cls, group, win, desc) {
    return { cls: cls, group: group, desc: desc, stream: [P.sync, P.avtp].concat(win, [P.can2, P.fu]) };
  }
  var SCEN = {
    normal: S(0, 'none', [P.req, P.can, P.avtp2, P.resp, P.sync],
      T('Ordinary mixed traffic: a SOME/IP request and its response, a CAN frame, audio stream data and a gPTP Sync.',
        '普通混合流量：一对 SOME/IP 请求与响应、一个 CAN 帧、音频流数据和一个 gPTP 同步报文。')),
    fi: S(1, 'tsn', [P.avtp2, injected, P.avtp3, injected, P.sync],
      T('Forged Ethernet frames are injected into a time-sensitive AVTP stream and disturb the receiving ECU.',
        '向时间敏感的 AVTP 流中注入伪造的以太网帧，干扰接收端 ECU。')),
    pi: S(2, 'tsn', [P.sync, P.fu, P.avtp2, fuForged, fuForged],
      T('Forged gPTP synchronization messages shift the clock and break time-aware scheduling.',
        '伪造的 gPTP 同步报文使时钟偏移，破坏基于时间的调度。')),
    mf: S(3, 'tsn', [floods[0], floods[1], P.avtp2, floods[2], floods[3]],
      T('Frames from many spoofed source MAC addresses flood the switch and pollute its MAC table.',
        '大量伪造源 MAC 地址的帧涌入交换机，污染其 MAC 表。')),
    cd: S(4, 'can', [canDos, canDos, P.avtp2, canDos, canDos],
      T('A flood of tunneled CAN frames with the top-priority ID starves legitimate control messages.',
        '大量最高优先级 ID 的隧道 CAN 帧，挤占合法的控制报文。')),
    cr: S(5, 'can', [P.can, P.avtp2, replayed, replayed, P.sync],
      T('CAN frames seen earlier are sent again to re-trigger stale actions.',
        '重放先前出现过的 CAN 帧，重新触发过时的动作。')),
    burst: S(6, 'som', [burst[0], burst[1], burst[2], burst[3], P.can],
      T('An attacker posing as the server floods the client with a burst of events.',
        '攻击者冒充服务端，在极短时间内向客户端发送大量事件。')),
    complex: S(7, 'som', [P.evt, malformed, mixed, corrupted, P.avtp2],
      T('Malformed, mixed and corrupted events are slipped in among valid-looking traffic.',
        '在看似正常的流量中混入格式错误、类型混杂和数据损坏的事件。')),
    reqwo: S(8, 'som', [P.can, spoofReq, P.avtp2, unaskedResp, P.sync],
      T('An attacker posing as the client sends a request; the server’s response reaches the real client, who never asked.',
        '攻击者冒充客户端发送请求，服务端的响应发给了从未发出请求的真实客户端。')),
    respwo: S(9, 'som', [P.sync, fakeResp, P.avtp2, fakeResp, P.can],
      T('An attacker posing as the server sends a fake response although no request was made.',
        '攻击者冒充服务端，在没有任何请求的情况下发送伪造响应。')),
    eoev: S(11, 'som', [P.evt, errOnEvent, P.avtp2, errOnEvent, P.can],
      T('An attacker posing as the client answers an event with an error reply, although events are never answered.',
        '攻击者冒充客户端，对事件回复错误报文；正常情况下事件不需要回复。')),
    eoer: S(10, 'som', [badReq, errMsg, errOnErr, P.avtp2, errOnErr],
      T('An attacker posing as the client answers an error message with yet another error reply.',
        '攻击者冒充客户端，对错误报文再回复一条错误报文。'))
  };
  var GROUPS = [
    ['none', ''],
    ['tsn', T('TSN / Ethernet', 'TSN / 以太网')],
    ['can', 'CAN-over-UDP'],
    ['som', 'SOME/IP']
  ];
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
  var scenBox = q('[data-scenarios]'), scenDesc = q('[data-scen-desc]');

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
    scenDesc.textContent = SCEN[scen].desc;
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
      row.appendChild(chip('ag-pkt-note', p.note));
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
      r.querySelector('.ag-pkt-note').textContent = r.dataset.ev;
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
  var scenBtns = [];
  GROUPS.forEach(function (g) {
    var row = document.createElement('div');
    row.className = 'ag-scen-group';
    row.appendChild(chip('ag-scen-label', g[1]));
    var btns = document.createElement('div');
    btns.className = 'ag-scen-btns';
    row.appendChild(btns);
    Object.keys(SCEN).forEach(function (key) {
      if (SCEN[key].group !== g[0]) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.scenario = key;
      b.textContent = key === 'normal' ? T('Normal traffic', '正常流量') : CLASSES[SCEN[key].cls];
      b.setAttribute('aria-pressed', String(key === scen));
      b.addEventListener('click', function () {
        scen = key;
        scenBtns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        reset();
      });
      scenBtns.push(b);
      btns.appendChild(b);
    });
    scenBox.appendChild(row);
  });

  reset();
})();
