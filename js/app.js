/* app.js - boot, router, theme, data loading, and remaining views. */
(function (root) {
  'use strict';
  var U = root.U, Progress = root.Progress;
  var App = { data: {}, views: {} };

  /* ---------- data ---------- */
  var DATA_FILES = ['notes', 'flashcards', 'questions', 'cheatsheet', 'tsim-scenarios'];
  var CONTENT_KEY = 'ccna-content-v1';

  function readImportedContent() {
    try { return JSON.parse(localStorage.getItem(CONTENT_KEY)) || null; }
    catch (e) { return null; }
  }

  function loadData() {
    var imported = readImportedContent();
    var base = window.APP_DATA || {};
    DATA_FILES.forEach(function (name) {
      App.data[name] = (imported && imported[name]) ? imported[name] : (base[name] || null);
    });
    route();
  }

  function exportContent() {
    var payload = {};
    DATA_FILES.forEach(function (name) { payload[name] = App.data[name]; });
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ccna-content.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importContent(file, done) {
    var r = new FileReader();
    r.onload = function () {
      var parsed;
      try { parsed = JSON.parse(String(r.result)); } catch (e) { done(false, 'Not valid JSON.'); return; }
      var bad = DATA_FILES.filter(function (name) { return !parsed || !parsed[name]; });
      if (bad.length) { done(false, 'Missing sections: ' + bad.join(', ')); return; }
      try { localStorage.setItem(CONTENT_KEY, JSON.stringify(parsed)); }
      catch (e) { done(false, 'Could not save to this browser (storage blocked).'); return; }
      loadData();
      done(true, 'Content imported. Views now use the new data.');
    };
    r.readAsText(file);
  }

  function resetContent() {
    localStorage.removeItem(CONTENT_KEY);
    loadData();
  }

  /* ---------- theme ---------- */
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', Progress.state.theme);
  }
  function toggleTheme() {
    Progress.setTheme(Progress.state.theme === 'dark' ? 'light' : 'dark');
    applyTheme();
  }

  /* ---------- views ---------- */
  var NAV = [
    ['learn', 'Learn'],
    ['trainers', 'Practice'],
    ['notes', 'Notes'],
    ['cheatsheet', 'Cheat Sheet'],
    ['flashcards', 'Flashcards'],
    ['quiz', 'Quiz'],
    ['tsim', 'Troubleshooting'],
    ['progress', 'Progress'],
    ['cram', 'Cram']
  ];

  function buildNav() {
    var nav = U.$('#nav');
    nav.innerHTML = '';
    NAV.forEach(function (pair) {
      var b = U.el('button', null, pair[1]);
      b.addEventListener('click', function () { location.hash = '#/' + pair[0]; });
      b.dataset.route = pair[0];
      nav.appendChild(b);
    });
  }

  function route() {
    var hash = location.hash.replace(/^#\/?/, '') || 'learn';
    var name = hash.split('?')[0];
    if (!App.views[name]) name = 'learn';
    document.onkeydown = null; // clear any view-specific key handler
    U.$$('#nav button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.route === name);
    });
    var view = U.$('#view');
    App.views[name](view);
  }

  function renderTitle(title, sub) {
    return U.el('div', null,
      U.el('h2', { class: 'view-title' }, title),
      U.el('p', { class: 'view-sub' }, sub));
  }

  /* ---------- Notes ---------- */
  App.views.notes = function (el) {
    el.innerHTML = '';
    var notes = App.data.notes;
    if (!notes) { el.appendChild(U.el('p', null, 'notes.json not loaded.')); return; }
    el.appendChild(renderTitle('Notes', 'Condensed, section-by-section. Collapsible. Toggle “learned” as you go — it feeds Progress.'));
    notes.modules.forEach(function (mod) {
      var secWrap = U.el('div', null);
      mod.sections.forEach(function (sec) {
        var body = U.el('div', null);
        if (sec.summary) body.appendChild(U.el('p', null, sec.summary));
        if (sec.points && sec.points.length) {
          var ul = U.el('ul');
          sec.points.forEach(function (p) { ul.appendChild(U.el('li', null, p)); });
          body.appendChild(ul);
        }
        (sec.tables || []).forEach(function (tbl) {
          if (tbl.caption) body.appendChild(U.el('div', { class: 'view-sub' }, tbl.caption));
          body.appendChild(U.table(tbl, { monoCells: [] }));
        });
        (sec.examples || []).forEach(function (ex) {
          body.appendChild(U.el('div', { class: 'term' }, U.esc(ex.code)));
        });
        var learned = Progress.isSectionDone(sec.id);
        var cb = U.el('input', { type: 'checkbox', class: 'toggle' });
        cb.checked = learned;
        cb.addEventListener('change', function () {
          Progress.state.sectionsDone[sec.id] = cb.checked;
          Progress.save();
          renderProgressBadge();
        });
        var headRow = U.el('div', { style: 'display:flex;align-items:center;gap:10px' },
          U.el('label', { class: 'toggle-label', style: 'white-space:nowrap' }, cb, ' learned'));
        var titleBar = U.el('div', { style: 'display:flex;align-items:center;gap:8px;justify-content:space-between' },
          U.el('span', null, sec.id + ' — ' + sec.title), headRow);
        secWrap.appendChild(U.collapse('', U.el('div', null, titleBar, body), false));
      });
      el.appendChild(U.el('div', { class: 'card', style: 'margin:14px 0' },
        U.el('h3', null, 'Module ' + mod.id + ' — ' + mod.title),
        secWrap));
    });
  };

  function renderProgressBadge() { /* noop hook */ }

  /* ---------- Cheat sheet ---------- */
  App.views.cheatsheet = function (el) {
    el.innerHTML = '';
    var cmds = App.data.cheatsheet && App.data.cheatsheet.commands;
    if (!cmds) { el.appendChild(U.el('p', null, 'cheatsheet.json not loaded.')); return; }
    el.appendChild(renderTitle('Command cheat sheet', 'Searchable. All IOS + host commands from the modules.'));
    var search = U.el('input', { type: 'text', placeholder: 'search commands… (e.g. show ip, traceroute)' });
    var list = U.el('div', { class: 'grid cols2' });
    el.appendChild(U.el('div', { class: 'card' }, search));
    el.appendChild(list);

    function renderAll() {
      var q = search.value.trim().toLowerCase();
      var filtered = cmds.filter(function (c) {
        if (!q) return true;
        return (c.name + ' ' + (c.syntax || '') + ' ' + (c.desc || '') + ' ' + (c.category || '')).toLowerCase().indexOf(q) !== -1;
      });
      list.innerHTML = '';
      var grouped = {};
      filtered.forEach(function (c) { (grouped[c.category || 'Other'] = grouped[c.category || 'Other'] || []).push(c); });
      Object.keys(grouped).forEach(function (cat) {
        var wrap = U.el('div', null, U.el('h4', { style: 'margin:8px 0 6px;color:var(--accent)' }, cat));
        grouped[cat].forEach(function (c) {
          wrap.appendChild(U.el('div', { class: 'card', style: 'margin:8px 0' },
            U.el('div', { class: 'mono', style: 'font-weight:700;color:var(--accent)' }, c.name + '   ' + U.el('span', { style: 'color:var(--text-dim);font-weight:400' }, U.esc(c.os || ''))),
            U.el('div', { class: 'mono', style: 'color:var(--text-dim)' }, U.esc(c.syntax || '')),
            U.el('p', null, U.esc(c.desc || '')),
            c.sample ? U.el('div', { class: 'term' }, U.esc(c.sample)) : null));
        });
        list.appendChild(wrap);
      });
      if (!filtered.length) list.appendChild(U.el('p', null, 'No commands match.'));
    }
    search.addEventListener('input', renderAll);
    renderAll();
  };

  /* ---------- Progress ---------- */
  App.views.progress = function (el) {
    el.innerHTML = '';
    el.appendChild(renderTitle('Progress', 'Tracked locally in your browser — no server, no accounts.'));
    var q = Progress.state.quiz;
    var modScores = ['11', '12', '17'].map(function (m) {
      var s = q[m];
      var pct = s && s.taken ? Math.round(100 * s.correct / s.taken) : 0;
      return U.el('div', { class: 'card' },
        U.el('h3', null, 'Module ' + m),
        s ? U.el('p', null, s.correct + ' / ' + s.taken + ' correct (' + pct + '%)')
           : U.el('p', null, 'No quiz taken yet.'),
        U.el('div', { class: 'bar' }, U.el('div', { style: 'width:' + pct + '%' })));
    });
    var weak = Object.keys(Progress.state.weak).sort(function (a, b) { return Progress.state.weak[b] - Progress.state.weak[a]; }).slice(0, 8);

    var sn = Progress.studyNext();
    var nextCard = U.el('div', { class: 'card' },
      U.el('h3', null, 'Study next'),
      U.el('p', null, 'Weakest module: <b>' + (sn.module ? 'Module ' + sn.module : '—') + '</b>'),
      weak.length
        ? U.el('div', null, U.el('div', null, 'Weak topics:'),
           weak.map(function (t) { return U.el('span', { class: 'badge', style: 'margin:2px' }, t + ' ×' + Progress.state.weak[t]); }))
        : U.el('p', null, 'No weak signals yet — take a quiz.'));

    var exportBtn = U.el('button', { class: 'btn' }, 'Export JSON');
    var importBtn = U.el('button', { class: 'btn ghost' }, 'Import JSON');
    var importInput = U.el('input', { type: 'file', accept: 'application/json', style: 'display:none' });
    var importMsg = U.el('div', { class: 'feedback', style: 'display:none' });
    exportBtn.addEventListener('click', Progress.exportJSON);
    importBtn.addEventListener('click', function () { importInput.click(); });
    importInput.addEventListener('change', function () {
      var f = importInput.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        var ok = Progress.importJSON(String(r.result));
        importMsg.style.display = 'block';
        importMsg.className = 'feedback ' + (ok ? 'ok' : 'err');
        importMsg.textContent = ok ? 'Progress imported.' : 'Invalid JSON — nothing changed.';
        if (ok) setTimeout(function () { App.views.progress(el); }, 800);
      };
      r.readAsText(f);
    });

    var cardCt = App.data.flashcards ? App.data.flashcards.length : 0;
    var secDone = Object.keys(Progress.state.sectionsDone).filter(function (k) { return Progress.state.sectionsDone[k]; }).length;
    var tsimDone = App.data.tsim ? App.data.tsim.scenarios.filter(function (s) { return Progress.tsimDone(s.id); }).length : 0;

    el.appendChild(U.el('div', { class: 'stats' },
      U.el('div', { class: 'stat card' }, U.el('div', { class: 'num' }, secDone), U.el('div', { class: 'lbl' }, 'sections learned')),
      U.el('div', { class: 'stat card' }, U.el('div', { class: 'num' }, cardCt), U.el('div', { class: 'lbl' }, 'flashcards')),
      U.el('div', { class: 'stat card' }, U.el('div', { class: 'num' }, tsimDone + ' / ' + (App.data.tsim ? App.data.tsim.scenarios.length : 0)), U.el('div', { class: 'lbl' }, 'scenarios solved'))));
    el.appendChild(U.el('div', { class: 'grid cols3' }, nextCard, U.el('div', null, modScores)));
    el.appendChild(U.el('div', { class: 'card', style: 'margin-top:14px' },
      U.el('h3', null, 'Backup'),
      U.el('p', { style: 'color:var(--text-dim)' }, 'Export saves your boxes, scores, and weak-topic history to a JSON file. Import restores it.'),
      U.el('div', { class: 'btnrow' }, exportBtn, importBtn, importInput, importMsg)));

    // content data import/export (swap lesson content without redeploying)
    var cExp = U.el('button', { class: 'btn' }, 'Export content');
    var cImp = U.el('button', { class: 'btn ghost' }, 'Import content');
    var cRst = U.el('button', { class: 'btn ghost' }, 'Reset content');
    var cFile = U.el('input', { type: 'file', accept: 'application/json', style: 'display:none' });
    var cMsg = U.el('div', { class: 'feedback', style: 'display:none' });
    cExp.addEventListener('click', exportContent);
    cImp.addEventListener('click', function () { cFile.click(); });
    cFile.addEventListener('change', function () {
      var f = cFile.files[0]; if (!f) return;
      importContent(f, function (ok, msg) {
        cMsg.style.display = 'block';
        cMsg.className = 'feedback ' + (ok ? 'ok' : 'err');
        cMsg.textContent = msg;
      });
    });
    cRst.addEventListener('click', function () {
      resetContent();
      cMsg.style.display = 'block';
      cMsg.className = 'feedback info';
      cMsg.textContent = 'Content reset to built-in.';
    });
    el.appendChild(U.el('div', { class: 'card', style: 'margin-top:14px' },
      U.el('h3', null, 'Content data'),
      U.el('p', { style: 'color:var(--text-dim)' },
        'Import/export the lesson content (notes, flashcards, questions, cheat sheet, scenarios) as one JSON file — so you can swap in your own slides without touching code or redeploying.'),
      U.el('div', { class: 'btnrow' }, cExp, cImp, cRst, cFile, cMsg)));
  };

  /* ---------- Cram (exam-eve) ---------- */
  App.views.cram = function (el) {
    el.innerHTML = '';
    el.appendChild(renderTitle('Cram sheets', 'The must-know facts and formulas per module. Read the night before.'));
    var cards = [
      {
        title: 'Module 11 · IPv4',
        formulas: [
          'Host bits h = 32 − prefix; usable hosts = 2^h − 2',
          'Subnets from a base = 2^(newPrefix − basePrefix)',
          'Block size (magic number) = 2^h (= 256 − mask octet in last octet)',
          'N subnets → borrow ceil(log2 N) bits',
          'H hosts → h = ceil(log2(H + 2))'
        ],
        facts: [
          'Network address = IP AND mask. Broadcast = network + block − 1. First host = net+1, last = broadcast−1.',
          'Private (RFC 1918): 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16',
          'Loopback 127.0.0.0/8 · link-local 169.254.0.0/16 · TEST-NET 192.0.2.0/24',
          'Legacy classful defaults: A /8, B /16, C /24',
          'Routers split broadcast domains; switches split collision domains',
          'VLSM: allocate largest requirement first, smallest mask that fits'
        ]
      },
      {
        title: 'Module 12 · IPv6',
        formulas: [
          'Abbreviate: strip leading zeros; collapse longest run of zero hextets to :: once; leftmost on ties; lowercase',
          'EUI-64: insert FFFE after octet 3, flip U/L bit (0x02) of octet 0',
          '/48 → /64 borrows 16 bits = 65,536 subnets',
          'Solicited-node = ff02::1:ff + last 24 bits of the address'
        ],
        facts: [
          'GUA 2000::/3 · LLA fe80::/10 · ULA fc00::/7 · multicast ff00::/8',
          'Loopback ::1 · unspecified :: · anycast shares unicast format (can’t tell apart by address)',
          'Dynamic: SLAAC (RA), stateless DHCPv6 (O-flag, optional info), stateful DHCPv6 (M-flag)',
          'Verify: show ipv6 interface brief, show ipv6 route',
          'Well-known multicast: ff02::1 all-nodes, ff02::2 all-routers, ff02::5 OSPF, ff02::9 RIPng, ff02::a EIGRP'
        ]
      },
      {
        title: 'Module 17 · Build a Small Network',
        formulas: [
          'Troubleshooting order: define → gather facts → top-down / bottom-up / divide-and-conquer → test → resolve or escalate'
        ],
        facts: [
          'Host: ipconfig /all (Win), ifconfig / ip addr (Linux), arp -a',
          'IOS: show ip interface brief, show ipv6 interface brief, show cdp neighbors, show version, show ip route',
          'Ping = L3 reachability. Extended ping lets you set source/protocol/size',
          'traceroute (Cisco/Linux) / tracert (Windows) show each hop',
          'debug + terminal monitor needed to see output on virtual lines (use sparingly!)',
          'Duplex mismatch → late collisions/CRC · wrong mask → same-LAN breaks · missing gateway → off-subnet fails · DNS → names fail but IP works'
        ]
      }
    ];
    var grid = U.el('div', { class: 'grid cols2' });
    cards.forEach(function (c) {
      var body = U.el('div', null,
        U.el('h4', { style: 'color:var(--accent);margin:6px 0' }, 'Formulas'),
        U.el('ul', null, c.formulas.map(function (f) { return U.el('li', null, f); })),
        U.el('h4', { style: 'color:var(--accent);margin:6px 0' }, 'Must know'),
        U.el('ul', null, c.facts.map(function (f) { return U.el('li', null, f); })));
      grid.appendChild(U.el('div', { class: 'card' }, U.el('h3', null, c.title), body));
    });
    el.appendChild(grid);
  };

  /* ---------- boot ---------- */
  Progress.load();
  applyTheme();
  buildNav();
  U.$('#themeBtn').addEventListener('click', toggleTheme);
  window.addEventListener('hashchange', route);
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  App.views.learn = root.Learn.render;
  App.views.trainers = root.Trainers.render;
  App.views.flashcards = root.Flashcards.render;
  App.views.quiz = root.Quiz.render;
  App.views.tsim = root.Tsim.render;

  loadData();
  root.App = App;
})(this);
