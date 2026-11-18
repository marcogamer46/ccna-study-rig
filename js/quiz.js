/* quiz.js - MCQ + type-the-command quiz. Attaches to window.Quiz. */
(function (root) {
  'use strict';
  var U = root.U, Progress = root.Progress;

  function shuffle(a) {
    var arr = a.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  var session = null;
  var pendingPool = null;

  function begin(questions, timedSeconds) {
    session = {
      queue: shuffle(questions),
      i: 0,
      correct: 0,
      perModule: {},
      wrongTags: [],
      missed: [],
      timed: timedSeconds > 0 ? timedSeconds : null,
      timerLeft: timedSeconds > 0 ? timedSeconds : null,
      timerId: null
    };
    renderQuestion();
  }

  function renderSetup(el) {
    if (pendingPool && pendingPool.length) { var p = pendingPool; pendingPool = null; begin(p, 0); return; }
    el.innerHTML = '';
    el.appendChild(U.el('h2', { class: 'view-title' }, 'Quiz'));
    el.appendChild(U.el('p', { class: 'view-sub' }, 'Scenario-style, like the CCNA exam. Answers are explained after each question.'));
    var modSel = U.el('select', null,
      U.el('option', { value: 'all' }, 'Mixed (all modules)'),
      U.el('option', { value: '11' }, 'Module 11 — IPv4'),
      U.el('option', { value: '12' }, 'Module 12 — IPv6'),
      U.el('option', { value: '17' }, 'Module 17 — Build a Small Network'));
    var nSel = U.el('select', null,
      U.el('option', { value: '10' }, '10 questions'),
      U.el('option', { value: '20' }, '20 questions'),
      U.el('option', { value: 'all' }, 'All questions'));
    var timedSel = U.el('select', null,
      U.el('option', { value: '0' }, 'No timer'),
      U.el('option', { value: '30' }, '30 seconds / question'),
      U.el('option', { value: '60' }, '60 seconds / question'));
    var startBtn = U.el('button', { class: 'btn primary' }, 'Start');
    var card = U.el('div', { class: 'card' },
      U.el('div', { class: 'grid cols2' },
        U.el('div', null, field('Module', modSel), field('Length', nSel)),
        U.el('div', null, field('Timer', timedSel))),
      U.el('div', { class: 'btnrow' }, startBtn));
    el.appendChild(card);

    function field(label, input) { return U.el('div', { class: 'field' }, U.el('label', null, label), input); }

    startBtn.addEventListener('click', function () {
      var mod = modSel.value;
      var pool = App.data.questions.filter(function (q) { return mod === 'all' || String(q.module) === mod; });
      if (!pool.length) { card.appendChild(U.el('div', { class: 'feedback err' }, 'No questions for that module yet.')); return; }
      if (nSel.value !== 'all') pool = shuffle(pool).slice(0, parseInt(nSel.value, 10));
      begin(pool, parseInt(timedSel.value, 10));
    });
  }

  function modLabel(m) { return { '11': '11 · IPv4', '12': '12 · IPv6', '17': '17 · Small Network' }[String(m)] || m; }

  function renderQuestion() {
    var el = U.$('#view');
    var q = session.queue[session.i];
    el.innerHTML = '';
    el.appendChild(U.el('h2', { class: 'view-title' }, 'Quiz'));
    el.appendChild(U.el('p', { class: 'view-sub' },
      'Question ' + (session.i + 1) + ' / ' + session.queue.length +
      ' · <span class="badge">' + U.esc(modLabel(q.module)) + '</span> · ' + U.esc(q.section || '')));

    var card = U.el('div', { class: 'card' });
    card.appendChild(U.el('div', { class: 'feedback info' }, U.esc(q.stem)));

    var answerArea = U.el('div');
    var nextBtn = U.el('button', { class: 'btn primary', style: 'display:none' }, 'Next →');

    function finishQuestion(wasCorrect, explanationHtml) {
      if (wasCorrect) session.correct++;
      var m = String(q.module);
      session.perModule[m] = session.perModule[m] || { correct: 0, total: 0 };
      session.perModule[m].total++;
      if (wasCorrect) session.perModule[m].correct++;
      else { session.wrongTags.push(q.section || m); session.missed.push(q); }
      if (session.timerId) { clearInterval(session.timerId); session.timerId = null; }
      var ex = U.el('div', { class: 'feedback ' + (wasCorrect ? 'ok' : 'err') });
      ex.innerHTML = (wasCorrect ? '<b>Correct.</b> ' : '<b>Incorrect.</b> ') + explanationHtml;
      card.appendChild(ex);
      nextBtn.style.display = 'inline-block';
    }

    if (q.type === 'mcq') {
      q.options.forEach(function (opt, idx) {
        var b = U.el('button', { class: 'quizopt' }, 'ABCD'[idx] + '   ' + opt);
        b.addEventListener('click', function () {
          U.$$('.quizopt', card).forEach(function (x) { x.disabled = true; });
          if (idx === q.answer) b.classList.add('correct');
          else {
            b.classList.add('wrong');
            U.$$('.quizopt', card)[q.answer].classList.add('correct');
          }
          finishQuestion(idx === q.answer, U.esc(q.explanation));
        });
        answerArea.appendChild(b);
      });
    } else {
      var inp = U.el('input', { type: 'text', class: 'quiz-input', placeholder: 'type the command…' });
      var submit = U.el('button', { class: 'btn primary' }, 'Submit');
      var row = U.el('div', { class: 'btnrow' }, submit);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit.click(); });
      submit.addEventListener('click', function () {
        var v = U.normCmd(inp.value);
        var accepted = [q.answer].concat(q.accepted || []).map(U.normCmd);
        var ok = accepted.indexOf(v) !== -1;
        row.appendChild(U.el('span', { class: 'feedback ' + (ok ? 'ok' : 'err') },
          ok ? '✓' : '✗'));
        inp.disabled = true; submit.disabled = true;
        finishQuestion(ok, U.esc(q.explanation));
      });
      answerArea.appendChild(inp);
      answerArea.appendChild(row);
    }

    nextBtn.addEventListener('click', function () {
      if (session.i + 1 < session.queue.length) { session.i++; renderQuestion(); }
      else renderSummary();
    });

    card.appendChild(answerArea);
    card.appendChild(nextBtn);
    el.appendChild(card);

    if (session.timed) {
      session.timerLeft = session.timed;
      var timerEl = U.el('span', { class: 'badge warn' }, '⏱ ' + session.timerLeft + 's');
      card.insertBefore(timerEl, card.firstChild);
      session.timerId = setInterval(function () {
        session.timerLeft--;
        timerEl.textContent = '⏱ ' + session.timerLeft + 's';
        if (session.timerLeft <= 0) {
          if (q.type === 'mcq') {
            U.$$('.quizopt', card).forEach(function (x) { x.disabled = true; });
            U.$$('.quizopt', card)[q.answer].classList.add('correct');
            finishQuestion(false, 'Time ran out. ' + U.esc(q.explanation));
          } else {
            finishQuestion(false, 'Time ran out. ' + U.esc(q.explanation));
          }
        }
      }, 1000);
    }
  }

  function renderSummary() {
    var el = U.$('#view');
    var total = session.queue.length;
    var pct = Math.round(100 * session.correct / Math.max(1, total));
    el.innerHTML = '';
    el.appendChild(U.el('h2', { class: 'view-title' }, 'Quiz complete'));
    var stats = U.el('div', { class: 'stats' },
      stat(session.correct + ' / ' + total, 'Correct'),
      stat(pct + '%', 'Score'));
    el.appendChild(stats);

    // record to progress, per module
    Object.keys(session.perModule).forEach(function (m) {
      var pm = session.perModule[m];
      Progress.recordQuiz(m, pm.correct, pm.total, session.wrongTags.filter(function (t) { return t.indexOf(m) === 0; }));
    });

    var row = U.el('div', { class: 'grid cols3' });
    Object.keys(session.perModule).forEach(function (m) {
      var pm = session.perModule[m];
      row.appendChild(U.el('div', { class: 'card' },
        U.el('h3', null, 'Module ' + m),
        U.el('p', null, pm.correct + ' / ' + pm.total + ' (' + Math.round(100 * pm.correct / pm.total) + '%)')));
    });
    el.appendChild(row);
    var btns = [
      U.el('button', { class: 'btn', onclick: function () { Quiz.render(U.$('#view')); } }, 'New quiz'),
      U.el('button', { class: 'btn ghost', onclick: function () { location.hash = '#/progress'; } }, 'See progress')
    ];
    if (session.missed.length) {
      btns.unshift(U.el('button', { class: 'btn primary', onclick: function () { begin(session.missed, 0); } },
        'Review the ' + session.missed.length + ' you missed'));
    }
    el.appendChild(U.el('div', { class: 'btnrow' }, btns));

    function stat(num, lbl) {
      return U.el('div', { class: 'stat card' }, U.el('div', { class: 'num' }, num), U.el('div', { class: 'lbl' }, lbl));
    }
  }

  root.Quiz = {
    render: function (el) { renderSetup(el); },
    startPool: function (pool) { pendingPool = pool; }
  };
})(this);
