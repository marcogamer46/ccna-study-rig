/* trainers.js - interactive trainers for IPv4 / IPv6. Attaches to window.Trainers. */
(function (root) {
  'use strict';
  var U = root.U, Net = root.Net, V6 = root.V6;

  function card(title, body, wide) {
    return U.el('div', { class: 'card' + (wide ? ' wide' : '') },
      U.el('h3', null, title), body);
  }

  function field(label, input) {
    return U.el('div', { class: 'field' }, U.el('label', null, label), input);
  }

  function feedbackNode() {
    var node = U.el('div', { class: 'feedback' });
    return node;
  }

  function setFeedback(node, kind, html) {
    node.className = 'feedback ' + kind;
    node.innerHTML = html;
  }

  /* ============ 1. IPv4 calculator (live) ============ */
  function calcWidget() {
    var ipIn = U.el('input', { type: 'text', placeholder: 'e.g. 192.168.10.130' });
    var pfxIn = U.el('input', { type: 'number', min: '0', max: '32', value: '26' });
    var out = U.el('div');
    function run() {
      try {
        var ip = ipIn.value.trim(), p = parseInt(pfxIn.value, 10);
        var s = Net.solve(ip, p);
        var rows = [
          ['Address', '<code>' + U.esc(ip) + '</code>'],
          ['Prefix', '/' + p + '  (' + U.esc(s.mask) + ')'],
          ['Network', '<code>' + U.esc(s.network) + '</code>'],
          ['Broadcast', '<code>' + U.esc(s.broadcast) + '</code>'],
          ['First host', '<code>' + U.esc(s.firstHost) + '</code>'],
          ['Last host', '<code>' + U.esc(s.lastHost) + '</code>'],
          ['Usable hosts', s.usableHosts + '  (2^' + s.hostBits + ' − 2)'],
          ['Subnet size (magic)', s.increment],
          ['Host bits', s.hostBits]
        ];
        var bin = U.el('div', { class: 'solution' },
          U.el('h4', null, 'Binary AND (toggle)'),
          U.el('div', { class: 'binrow' }, U.el('span', { class: 'lbl' }, 'IP  '), U.el('span', null, s.binary.ip.join(' '))),
          U.el('div', { class: 'binrow' }, U.el('span', { class: 'lbl' }, 'MSK '), U.el('span', null, s.binary.mask.join(' '))),
          U.el('div', { class: 'binrow' }, U.el('span', { class: 'lbl' }, 'NET '), U.el('span', null, s.binary.network.join(' '))));
        out.innerHTML = '';
        out.appendChild(U.table({ headers: ['Property', 'Value'], rows: rows }, {}));
        out.appendChild(bin);
      } catch (e) {
        out.innerHTML = '';
        out.appendChild(U.el('div', { class: 'feedback err' }, U.esc(e.message)));
      }
    }
    ipIn.addEventListener('input', run);
    pfxIn.addEventListener('input', run);
    run();
    return U.el('div', null,
      field('IP address', ipIn),
      field('Prefix length', pfxIn),
      out);
  }

  /* ============ 2. subnet facts drill ============ */
  function factsDrill() {
    var diff = U.el('select', null,
      U.el('option', { value: 'within' }, 'Within an octet (/24 carve)'),
      U.el('option', { value: 'octets' }, 'Across octets (/16 or /8)'),
      U.el('option', { value: 'boundary' }, 'Octet boundary (/16 → /24)'));
    var genBtn = U.el('button', { class: 'btn' }, 'New problem');
    var binToggle = U.toggleInput('show binary', false, function () { if (cur) paintSolution(); });
    var head = U.el('div', { class: 'btnrow' }, diff, genBtn);
    var prob = U.el('pre', { class: 'mono' });
    var fields = {};
    ['network', 'broadcast', 'first', 'last', 'hosts', 'subnets'].forEach(function (k) {
      fields[k] = U.el('input', { type: 'text', placeholder: '?' });
    });
    var checkBtn = U.el('button', { class: 'btn primary' }, 'Check answers');
    var fb = feedbackNode();
    var sol = U.el('div', { class: 'solution' });
    var wrap = U.el('div', null, head, prob,
      U.el('div', { class: 'grid cols2' },
        U.el('div', null, field('Network', fields.network), field('Broadcast', fields.broadcast), field('First host', fields.first), field('Last host', fields.last)),
        U.el('div', null, field('Usable hosts', fields.hosts), field('Subnets from /base', fields.subnets))),
      U.el('div', { class: 'btnrow' }, checkBtn, binToggle), fb, sol);

    var cur = null;
    function showProblem() {
      var p = Net.randomProblem(diff.value);
      cur = p;
      prob.textContent = 'Problem:  ' + p.ip + ' /' + p.prefix + '   (carve from /' + p.basePrefix + ')';
      Object.keys(fields).forEach(function (k) { fields[k].value = ''; fields[k].className = ''; });
      setFeedback(fb, 'info', 'Type your answers, then hit Check.');
      sol.innerHTML = '';
    }
    function paintSolution() {
      var p = cur, s = Net.solve(p.ip, p.prefix);
      sol.innerHTML = '';
      sol.appendChild(U.el('h4', null, 'Worked solution (magic number method)'));
      sol.appendChild(U.el('p', null, U.esc(s.magicNote)));
      sol.appendChild(U.table({
        headers: ['Step', 'Value'],
        rows: [
          ['Host bits', '32 − /' + p.prefix + ' = ' + s.hostBits],
          ['Block size (magic number)', '2^' + s.hostBits + ' = ' + s.increment +
            (function () {
              var mo = parseInt(s.mask.split('.').pop(), 10);
              return p.basePrefix === 24 ? '  (256 − ' + mo + ' = ' + s.increment + ', last octet)' : '';
            })()],
          ['Number of subnets', '2^(' + p.prefix + ' − /' + p.basePrefix + ') = ' + p.subnetsFromBase],
          ['Network (IP AND mask)', '<b>' + U.esc(s.network) + '</b>'],
          ['First host', '<code>' + U.esc(s.firstHost) + '</code>'],
          ['Last host', '<code>' + U.esc(s.lastHost) + '</code>'],
          ['Broadcast', '<b>' + U.esc(s.broadcast) + '</b>'],
          ['Usable hosts', '2^' + s.hostBits + ' − 2 = ' + s.usableHosts]
        ]
      }), {});
      if (binToggle.querySelector('input').checked) {
        sol.appendChild(U.el('h4', null, 'Binary'));
        sol.appendChild(U.el('div', { class: 'binrow' }, U.el('span', { class: 'lbl' }, 'IP '), U.el('span', null, s.binary.ip.join(' '))));
        sol.appendChild(U.el('div', { class: 'binrow' }, U.el('span', { class: 'lbl' }, 'MSK'), U.el('span', null, s.binary.mask.join(' '))));
        sol.appendChild(U.el('div', { class: 'binrow' }, U.el('span', { class: 'lbl' }, 'NET'), U.el('span', null, s.binary.network.join(' '))));
      }
    }
    function check() {
      var p = cur; if (!p) return;
      var good = 0, total = 0, bad = [];
      function expect(fieldKey, expectedStr) {
        total++;
        var v = fields[fieldKey].value.trim();
        try { if (Net.ipToInt(v) === Net.ipToInt(expectedStr)) { good++; fields[fieldKey].className = ''; } else { fields[fieldKey].className = 'err'; bad.push(fieldKey); } }
        catch (e) { fields[fieldKey].className = 'err'; bad.push(fieldKey); }
      }
      expect('network', p.network);
      expect('broadcast', p.broadcast);
      expect('first', p.firstHost);
      expect('last', p.lastHost);
      total++;
      if (String(fields.hosts.value.trim()) === String(p.usableHosts)) { good++; fields.hosts.className = ''; }
      else { fields.hosts.className = 'err'; bad.push('hosts'); }
      total++;
      if (String(fields.subnets.value.trim()) === String(p.subnetsFromBase)) { good++; fields.subnets.className = ''; }
      else { fields.subnets.className = 'err'; bad.push('subnets'); }
      setFeedback(fb, good === total ? 'ok' : 'err',
        good === total
          ? '<b>All correct.</b> Nice. Show solution to review the steps.'
          : '<b>' + good + '/' + total + ' correct.</b> Wrong: ' + bad.join(', ') + '. Show solution to see the steps.');
      paintSolution();
    }
    genBtn.addEventListener('click', showProblem);
    checkBtn.addEventListener('click', check);
    showProblem();
    return wrap;
  }

  /* ============ 3. requirement drill (N subnets / N hosts) ============ */
  function reqDrill() {
    var mode = U.el('select', null,
      U.el('option', { value: 'subnets' }, 'I need N subnets'),
      U.el('option', { value: 'hosts' }, 'I need N hosts per subnet'));
    var genBtn = U.el('button', { class: 'btn' }, 'New problem');
    var baseOut = U.el('pre', { class: 'mono' });
    var pfxIn = U.el('input', { type: 'text', placeholder: 'e.g. 26' });
    var checkBtn = U.el('button', { class: 'btn primary' }, 'Check');
    var fb = feedbackNode();
    var sol = U.el('div', { class: 'solution' });
    var wrap = U.el('div', null,
      U.el('div', { class: 'btnrow' }, mode, genBtn),
      baseOut,
      field('New prefix length', pfxIn),
      U.el('div', { class: 'btnrow' }, checkBtn), fb, sol);
    var cur = null;

    function newProblem() {
      var basePrefix = Math.random() < 0.5 ? 24 : 16;
      var target;
      if (mode.value === 'subnets') {
        var n = 2 + Math.floor(Math.random() * 14); // 2..15 subnets
        target = Net.prefixForSubnets(basePrefix, n);
        cur = { kind: 'subnets', basePrefix: basePrefix, n: n, target: target };
        baseOut.textContent = 'Base network prefix: /' + basePrefix + '\nQuestion: I need ' + n + ' subnets. What prefix length?';
      } else {
        var h = [2, 6, 14, 30, 62, 126, 254, 510, 2, 14][Math.floor(Math.random() * 10)];
        target = Net.prefixForHosts(h);
        cur = { kind: 'hosts', basePrefix: basePrefix, n: h, target: target };
        baseOut.textContent = 'Base network prefix: /' + basePrefix + '\nQuestion: I need ' + h + ' usable hosts per subnet. What prefix length?';
      }
      pfxIn.value = '';
      pfxIn.className = '';
      setFeedback(fb, 'info', 'Enter the new prefix length (just the number).');
      sol.innerHTML = '';
    }
    function check() {
      if (!cur) return;
      var v = parseInt(pfxIn.value.trim().replace(/^\//, ''), 10);
      if (v === cur.target) {
        pfxIn.className = '';
        setFeedback(fb, 'ok', '<b>Correct: /' + cur.target + '</b>');
      } else {
        pfxIn.className = 'err';
        if (isNaN(v)) setFeedback(fb, 'err', 'Enter a number.');
        else if (v < cur.target) setFeedback(fb, 'err', 'Too short a mask — that supports more hosts/subnets than needed.');
        else setFeedback(fb, 'err', 'Too long a mask — that carves more subnets / fewer hosts than needed.');
      }
      sol.innerHTML = '';
      sol.appendChild(U.el('h4', null, 'Worked solution'));
      if (cur.kind === 'subnets') {
        sol.appendChild(U.el('p', null, 'Need 2^b ≥ ' + cur.n + ' → b = ' + Math.ceil(Math.log2(cur.n)) +
          ' borrowed bits. New prefix = /' + cur.basePrefix + ' + ' + Math.ceil(Math.log2(cur.n)) + ' = /' + cur.target + '.'));
      } else {
        var hbits = 32 - cur.target;
        sol.appendChild(U.el('p', null, 'Need 2^h − 2 ≥ ' + cur.n + ' → h = ' + hbits +
          ' host bits. New prefix = 32 − ' + hbits + ' = /' + cur.target + '.'));
      }
    }
    genBtn.addEventListener('click', newProblem);
    checkBtn.addEventListener('click', check);
    newProblem();
    return wrap;
  }

  /* ============ 4. VLSM planner ============ */
  function vlsmWidget() {
    var baseIn = U.el('input', { type: 'text', placeholder: '192.168.10.0/24', value: '192.168.10.0/24' });
    var reqsIn = U.el('textarea', { rows: '4', placeholder: 'one requirement per line, largest first or any order:\nSales = 60\nHR = 30\nIT = 10\nMgmt = 2' });
    var goBtn = U.el('button', { class: 'btn primary' }, 'Plan');
    var out = U.el('div');
    var wrap = U.el('div', null,
      field('Base network (ip/prefix)', baseIn),
      field('Host requirements (name = hosts)', reqsIn),
      U.el('div', { class: 'btnrow' }, goBtn), out);

    function plan() {
      out.innerHTML = '';
      var m = /^([\d.]+)\/(\d+)$/.exec(baseIn.value.trim());
      if (!m) { out.appendChild(U.el('div', { class: 'feedback err' }, 'Base must look like 192.168.10.0/24')); return; }
      var baseIp = m[1], baseP = parseInt(m[2], 10);
      var reqs = [];
      reqsIn.value.split('\n').forEach(function (line) {
        line = line.trim(); if (!line) return;
        var mm = /^(.+?)\s*=\s*(\d+)$/.exec(line);
        if (mm) reqs.push({ name: mm[1].trim(), hosts: parseInt(mm[2], 10) });
        else { var just = parseInt(line, 10); if (!isNaN(just)) reqs.push({ name: 'Subnet ' + (reqs.length + 1), hosts: just }); }
      });
      if (!reqs.length) { out.appendChild(U.el('div', { class: 'feedback err' }, 'No valid requirements found.')); return; }
      var res = Net.vlsmAllocate(baseIp, baseP, reqs);
      if (res.overflow) {
        out.appendChild(U.el('div', { class: 'feedback err' },
          '<b>Overflow.</b> The requirements total more space than /' + baseP + ' provides. Remove or shrink some.'));
      }
      var rows = res.rows.map(function (r) {
        return [r.name, '/' + r.prefix, r.network, r.firstHost + ' – ' + r.lastHost, r.broadcast, r.usable, r.wasted];
      });
      out.appendChild(U.el('p', null, 'Sorted largest-first, allocated smallest-fit in order.'));
      out.appendChild(U.table({
        headers: ['Subnet', 'Mask', 'Network', 'Host range', 'Broadcast', 'Usable', 'Wasted'],
        rows: rows
      }, { monoCells: [2, 3, 4] }));
    }
    goBtn.addEventListener('click', plan);
    plan();
    return wrap;
  }

  /* ============ IPv6 helpers for trainers ============ */
  function randHextet() {
    return Math.floor(Math.random() * 65536).toString(16);
  }
  function pad4(s) { while (s.length < 4) s = '0' + s; return s; }
  function fullV6(forceZeros) {
    var tokens = [];
    for (var i = 0; i < 8; i++) tokens.push(pad4(randHextet()));
    if (forceZeros) {
      // inject a run of 2-4 zeros and sprinkle a leading-zero hextet
      var start = 1 + Math.floor(Math.random() * 3);
      var len = 2 + Math.floor(Math.random() * 3);
      for (var j = start; j < Math.min(8, start + len); j++) tokens[j] = '0000';
      var idx = Math.floor(Math.random() * 8);
      if (tokens[idx] !== '0000') tokens[idx] = '0' + tokens[idx].slice(1);
      if (tokens[idx].length > 4) tokens[idx] = tokens[idx].slice(0, 4);
    }
    return tokens.join(':');
  }

  /* ============ 5. IPv6 abbreviator ============ */
  function abbrDrill() {
    var genBtn = U.el('button', { class: 'btn' }, 'New address');
    var prompt = U.el('pre', { class: 'mono' });
    var inEl = U.el('input', { type: 'text', placeholder: 'shortest valid form' });
    var checkBtn = U.el('button', { class: 'btn primary' }, 'Check');
    var revealBtn = U.el('button', { class: 'btn ghost' }, 'Reveal');
    var fb = feedbackNode();
    var wrap = U.el('div', null,
      U.el('div', { class: 'btnrow' }, genBtn),
      prompt, field('Your answer', inEl),
      U.el('div', { class: 'btnrow' }, checkBtn, revealBtn), fb);
    var full = null;

    function newOne() {
      full = fullV6(true);
      prompt.textContent = 'Expand / abbreviate:\n' + full;
      inEl.value = ''; inEl.className = '';
      setFeedback(fb, 'info', 'Rules: omit leading zeros; collapse the LONGEST run of zero hextets to :: exactly once (leftmost on ties).');
    }
    function check() {
      var user = inEl.value.trim();
      var canon = V6.abbreviate(full);
      try {
        var u = V6.parseFull(user);
        var t = V6.parseFull(full);
        if (u.join() !== t.join()) {
          setFeedback(fb, 'err', 'That does not represent the same address — count the hextets / check for a stray colon.');
          return;
        }
      } catch (e) { setFeedback(fb, 'err', 'Unparseable: ' + U.esc(e.message)); return; }
      if (user.toLowerCase().replace(/\s+/g, '') === canon) {
        inEl.className = '';
        setFeedback(fb, 'ok', '<b>Correct:</b> <code>' + U.esc(canon) + '</code>');
      } else {
        inEl.className = 'err';
        var hints = [];
        var clean = user.toLowerCase().replace(/\s+/g, '');
        var full8 = V6.parseFull(full).map(function (x) { return parseInt(x, 16).toString(16); });
        if (clean.indexOf('::') === -1 && full8.indexOf('0') !== -1) {
          var runMax = 0, curRun = 0;
          full8.forEach(function (x) { curRun = (x === '0') ? curRun + 1 : 0; runMax = Math.max(runMax, curRun); });
          if (runMax >= 2) hints.push('collapse the run of ' + runMax + ' zero hextets to ::');
        }
        if (clean.indexOf('::') !== -1 && canon.indexOf('::') === -1) hints.push('there is no run of 2+ zero hextets to collapse');
        if (/::.*::/.test(clean)) hints.push('only one :: is allowed');
        if (/0[0-9a-f]/.test(clean)) hints.push('remove leading zeros from hextets');
        if (/[A-Z]/.test(user)) hints.push('lowercase is standard (matches here, but keep lowercase)');
        setFeedback(fb, 'err', 'Not the shortest form. Hint: ' + (hints.join('; ') || 'compare against the reveal'));
      }
    }
    genBtn.addEventListener('click', newOne);
    checkBtn.addEventListener('click', check);
    revealBtn.addEventListener('click', function () {
      setFeedback(fb, 'info', 'Shortest form: <code>' + U.esc(V6.abbreviate(full)) + '</code>');
    });
    newOne();
    return wrap;
  }

  /* ============ 6. IPv6 expander ============ */
  function expandDrill() {
    var genBtn = U.el('button', { class: 'btn' }, 'New address');
    var prompt = U.el('pre', { class: 'mono' });
    var inEl = U.el('input', { type: 'text', placeholder: 'full 8-hextet form' });
    var checkBtn = U.el('button', { class: 'btn primary' }, 'Check');
    var revealBtn = U.el('button', { class: 'btn ghost' }, 'Reveal');
    var fb = feedbackNode();
    var wrap = U.el('div', null,
      U.el('div', { class: 'btnrow' }, genBtn), prompt,
      field('Expand to full 8 hextets', inEl),
      U.el('div', { class: 'btnrow' }, checkBtn, revealBtn), fb);
    var canon = null;
    function newOne() {
      var full = fullV6(true);
      canon = V6.abbreviate(full);
      prompt.textContent = 'Expand:\n' + canon;
      inEl.value = ''; inEl.className = '';
      setFeedback(fb, 'info', 'Write all 8 hextets, zero-padded to four digits each.');
    }
    function check() {
      try {
        var u = V6.parseFull(inEl.value.trim());
        var t = V6.parseFull(canon);
        if (u.join() === t.join()) { inEl.className = ''; setFeedback(fb, 'ok', 'Correct: <code>' + U.esc(u.join(':')) + '</code>'); }
        else {
          inEl.className = 'err';
          setFeedback(fb, 'err', 'Not a match. You have ' + u.length + ' groups; expect 8. Each hextet must be 4 hex digits.');
        }
      } catch (e) { inEl.className = 'err'; setFeedback(fb, 'err', 'Unparseable: ' + U.esc(e.message)); }
    }
    genBtn.addEventListener('click', newOne);
    checkBtn.addEventListener('click', check);
    revealBtn.addEventListener('click', function () {
      setFeedback(fb, 'info', 'Full form: <code>' + U.esc(V6.parseFull(canon).join(':')) + '</code>');
    });
    newOne();
    return wrap;
  }

  /* ============ 7. EUI-64 converter + drill ============ */
  function euiWidget() {
    var macIn = U.el('input', { type: 'text', placeholder: '00:1C:42:AB:CD:EF', value: '00:1C:42:AB:CD:EF' });
    var goBtn = U.el('button', { class: 'btn' }, 'Convert');
    var out = U.el('div');
    var drillBtn = U.el('button', { class: 'btn ghost' }, 'Practice: random MAC');
    var drillIn = U.el('input', { type: 'text', placeholder: 'interface ID' });
    var drillCheck = U.el('button', { class: 'btn primary' }, 'Check');
    var drillFb = feedbackNode();
    var drillPrompt = U.el('pre', { class: 'mono' });
    var curMac = null;

    function convert() {
      out.innerHTML = '';
      try {
        var r = V6.macToEui64(macIn.value);
        out.appendChild(U.table({
          headers: ['Step', 'Value'],
          rows: [
            ['MAC', '<code>' + U.esc(r.macLow) + '</code>'],
            ['Insert FFFE (between octet 3 & 4)', '—'],
            ['Flip U/L bit of first octet (' + r.flippedOldHex + ' → ' + r.flippedNewHex + ')', 'bit 1 (0x02) toggled'],
            ['Interface ID', '<b><code>' + U.esc(r.interfaceId) + '</code></b>']
          ]
        }, {}));
        out.appendChild(U.el('div', { class: 'feedback info' },
          'U/L bit: the second-least-significant bit of the first octet. ' +
          '0x' + r.flippedOldHex + ' → 0x' + r.flippedNewHex + ' sets the locally-administered flag.'));
      } catch (e) { out.appendChild(U.el('div', { class: 'feedback err' }, U.esc(e.message))); }
    }
    function drillNew() {
      var b = [];
      for (var i = 0; i < 6; i++) b.push(pad4(randHextet()).slice(0, 2));
      curMac = b.join(':').toUpperCase();
      drillPrompt.textContent = 'MAC: ' + curMac + '\nCompute the EUI-64 interface ID.';
      drillIn.value = ''; drillIn.className = '';
      setFeedback(drillFb, 'info', '');
    }
    function drillCheck() {
      if (!curMac) return;
      var expected = V6.macToEui64(curMac).interfaceId;
      var v = drillIn.value.trim().toLowerCase();
      if (v === expected) { drillIn.className = ''; setFeedback(drillFb, 'ok', 'Correct: <code>' + U.esc(expected) + '</code>'); }
      else { drillIn.className = 'err'; setFeedback(drillFb, 'err', 'Not quite. Expected <code>' + U.esc(expected) + '</code>'); }
    }
    macIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') convert(); });
    goBtn.addEventListener('click', convert);
    drillBtn.addEventListener('click', drillNew);
    drillCheck.addEventListener('click', drillCheck);
    convert();
    return U.el('div', null,
      field('MAC address', macIn),
      U.el('div', { class: 'btnrow' }, goBtn), out,
      U.el('hr'),
      U.el('div', { class: 'btnrow' }, drillBtn), drillPrompt,
      field('Your interface ID', drillIn),
      U.el('div', { class: 'btnrow' }, drillCheck), drillFb);
  }

  /* ============ 8. IPv6 type identifier ============ */
  function typeDrill() {
    var pool = [
      ['2001:db8:1::1', 'Global unicast'],
      ['2001:db8::a:1', 'Global unicast'],
      ['fe80::1', 'Link-local'],
      ['fe80::abba:1', 'Link-local'],
      ['fc00::1234:abcd', 'Unique-local'],
      ['fd00::1', 'Unique-local'],
      ['ff02::1', 'Multicast (all-nodes)'],
      ['ff02::2', 'Multicast (all-routers)'],
      ['ff02::5', 'Multicast (OSPF)'],
      ['ff02::1:ff34:5678', 'Solicited-node multicast'],
      ['::1', 'Loopback'],
      ['::', 'Unspecified']
    ];
    var addr = U.el('pre', { class: 'mono' });
    var choices = U.el('div', { class: 'btnrow' });
    var fb = feedbackNode();
    var nextBtn = U.el('button', { class: 'btn' }, 'Next address');
    var wrap = U.el('div', null, addr, choices, fb, nextBtn);
    var curType = '';
    function newOne() {
      var pick = pool[Math.floor(Math.random() * pool.length)];
      addr.textContent = 'Classify:  ' + pick[0];
      curType = pick[1];
      setFeedback(fb, 'info', '');
      choices.innerHTML = '';
      var types = ['Global unicast', 'Link-local', 'Unique-local', 'Multicast', 'Solicited-node multicast', 'Loopback', 'Unspecified'];
      types.forEach(function (t) {
        var b = U.el('button', { class: 'btn sm' }, t);
        b.addEventListener('click', function () {
          var cls = V6.classify(pick[0]);
          if (t === (curType.split(' ')[0]) || cls.type.indexOf(t) !== -1) {
            setFeedback(fb, 'ok', '<b>Correct:</b> ' + U.esc(cls.type) + (cls.group ? ' — ' + U.esc(cls.group) : '') + '. ' + U.esc(cls.note));
          } else {
            setFeedback(fb, 'err', 'Not that. ' + U.esc(cls.type) + '. ' + U.esc(cls.note));
          }
        });
        choices.appendChild(b);
      });
    }
    nextBtn.addEventListener('click', newOne);
    newOne();
    return wrap;
  }

  /* ============ 9. IPv6 subnet ID (/48 → /64) ============ */
  function subnetIdWidget() {
    var genBtn = U.el('button', { class: 'btn' }, 'New /48');
    var prompt = U.el('pre', { class: 'mono' });
    var countIn = U.el('input', { type: 'text', placeholder: '?' });
    var checkBtn = U.el('button', { class: 'btn primary' }, 'Check');
    var fb = feedbackNode();
    var list = U.el('div');
    var wrap = U.el('div', null,
      U.el('div', { class: 'btnrow' }, genBtn), prompt,
      field('How many /64 subnets fit in this /48?', countIn),
      U.el('div', { class: 'btnrow' }, checkBtn), fb, list);
    var cur = null;
    function newOne() {
      var a = randHextet(), b = randHextet(), c = randHextet();
      cur = '2001:db8:' + a + ':' + c + '::/48';
      prompt.textContent = 'GUA: ' + cur + '\nSubnet the Subnet ID (hextet 3) to /64.';
      countIn.value = ''; countIn.className = '';
      setFeedback(fb, 'info', '');
      list.innerHTML = '';
    }
    function check() {
      var n = parseInt(countIn.value.trim(), 10);
      if (n === 65536) {
        countIn.className = '';
        setFeedback(fb, 'ok', '<b>Correct: 65,536</b> /64 subnets (16 subnet bits: 2^16).');
        var basePart = cur.slice(0, cur.indexOf('::'));
        var v = basePart.split(':');
        var hextet3 = v[3] || '0000';
        var rows = [];
        for (var i = 0; i < 4; i++) {
          var sid = (parseInt(hextet3, 16) + i).toString(16);
          while (sid.length < 4) sid = '0' + sid;
          rows.push([v[0] + ':' + v[1] + ':' + v[2] + ':' + sid + '::/64']);
        }
        list.innerHTML = '';
        list.appendChild(U.el('p', null, 'First four subnet network addresses:'));
        list.appendChild(U.table({ headers: ['Subnet (network)'], rows: rows }, {}));
      } else {
        countIn.className = 'err';
        setFeedback(fb, 'err', 'Not that. /48 → /64 borrows 16 bits → 2^16 = 65,536 subnets.');
      }
    }
    genBtn.addEventListener('click', newOne);
    checkBtn.addEventListener('click', check);
    newOne();
    return wrap;
  }

  /* ============ render ============ */
  root.Trainers = {
    render: function (el) {
      el.innerHTML = '';
      el.appendChild(U.el('h2', { class: 'view-title' }, 'Trainers'));
      el.appendChild(U.el('p', { class: 'view-sub' }, 'Active practice, not passive reading. The math below is the same engine the tests verify.'));
      var grid = U.el('div', { class: 'grid cols2' });
      grid.appendChild(card('IPv4 Calculator', calcWidget()));
      grid.appendChild(card('Subnetting drill (magic number)', factsDrill()));
      grid.appendChild(card('“I need N subnets / N hosts”', reqDrill()));
      grid.appendChild(card('VLSM planner', vlsmWidget()));
      grid.appendChild(card('IPv6 abbreviator', abbrDrill()));
      grid.appendChild(card('IPv6 expander', expandDrill()));
      grid.appendChild(card('EUI-64 converter + drill', euiWidget()));
      grid.appendChild(card('IPv6 address type identifier', typeDrill()));
      grid.appendChild(card('IPv6 subnet ID (/48 → /64)', subnetIdWidget()));
      el.appendChild(grid);
    }
  };
})(this);
