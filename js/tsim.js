/* tsim.js - troubleshooting scenario simulator. Attaches to window.Tsim. */
(function (root) {
  'use strict';
  var U = root.U, Progress = root.Progress;

  function render(el) {
    el.innerHTML = '';
    el.appendChild(U.el('h2', { class: 'view-title' }, 'Troubleshooting simulator'));
    el.appendChild(U.el('p', { class: 'view-sub' },
      'Module 17 style: read the topology and symptom, examine the console, and pick the right diagnostic at each step.'));

    var scenarios = App.data.tsim.scenarios;
    var grid = U.el('div', { class: 'grid cols2' });
    scenarios.forEach(function (s) {
      var done = Progress.tsimDone(s.id);
      var btn = U.el('button', { class: 'btn' + (done ? ' ghost' : ' primary') }, done ? 'Review again' : 'Start');
      var card = U.el('div', { class: 'card' },
        U.el('h3', null, s.title),
        U.el('div', null, U.el('span', { class: 'badge' }, s.badge), done ? U.el('span', { class: 'badge ok', style: 'margin-left:6px' }, 'solved') : ''),
        U.el('p', null, U.esc(s.symptom)),
        U.el('div', { class: 'btnrow' }, btn));
      btn.addEventListener('click', function () { play(s); });
      grid.appendChild(card);
    });
    el.appendChild(grid);
  }

  function play(scenario) {
    var el = U.$('#view');
    var mistakes = 0, stepIdx = 0;
    el.innerHTML = '';
    el.appendChild(U.el('h2', { class: 'view-title' }, scenario.title));
    el.appendChild(U.el('span', { class: 'badge' }, scenario.badge));

    var layout = U.el('div', { class: 'grid cols2' });
    var left = U.el('div', { class: 'card' },
      U.el('h3', null, 'Topology'),
      U.el('p', null, U.esc(scenario.topology)),
      U.el('h3', null, 'Symptom'),
      U.el('p', null, U.esc(scenario.symptom)));
    var right = U.el('div', { class: 'card' },
      U.el('h3', null, 'Console'),
      U.el('div', { class: 'console' }));
    layout.appendChild(left); layout.appendChild(right);
    el.appendChild(layout);

    var consoleEl = right.querySelector('.console');
    scenario.console.forEach(function (c) { printCmd(c); });

    var stepArea = U.el('div', { class: 'card', style: 'margin-top:14px' });
    el.appendChild(stepArea);

    function printCmd(c) {
      consoleEl.appendChild(U.el('div', { class: 'term' },
        U.el('div', { style: 'color:#8b98a8' }, '$ ' + U.esc(c.cmd)),
        U.esc(c.out)));
      consoleEl.scrollTop = consoleEl.scrollHeight;
    }

    function renderStep() {
      stepArea.innerHTML = '';
      if (stepIdx >= scenario.steps.length) {
        stepArea.appendChild(U.el('h3', null, 'Resolution'));
        stepArea.appendChild(U.el('p', null, U.esc(scenario.resolution)));
        stepArea.appendChild(U.el('div', { class: 'feedback ' + (mistakes === 0 ? 'ok' : 'info') },
          mistakes === 0 ? 'Solved with no wrong diagnostic.' : 'Solved after ' + mistakes + ' wrong pick(s).'));
        Progress.setTsimDone(scenario.id);
        stepArea.appendChild(U.el('div', { class: 'btnrow' },
          U.el('button', { class: 'btn', onclick: function () { Tsim.render(el); } }, 'Back to scenarios')));
        return;
      }
      var step = scenario.steps[stepIdx];
      stepArea.appendChild(U.el('h3', null, 'Step ' + (stepIdx + 1) + ' / ' + scenario.steps.length));
      stepArea.appendChild(U.el('p', null, U.esc(step.prompt)));
      var fb = U.el('div', { class: 'feedback', style: 'display:none' });
      step.choices.forEach(function (ch, ci) {
        var b = U.el('button', { class: 'btn sm', style: 'margin:0 6px 6px 0' }, ch.label);
        b.addEventListener('click', function () {
          fb.style.display = 'block';
          if (ch.correct) {
            fb.className = 'feedback ok';
            fb.innerHTML = '<b>Good.</b> ' + U.esc(ch.why);
            (ch.reveal || []).forEach(printCmd);
            stepIdx++;
            setTimeout(renderStep, 600);
          } else {
            mistakes++;
            fb.className = 'feedback err';
            fb.innerHTML = '<b>Not the best next step.</b> ' + U.esc(ch.why);
          }
        });
        stepArea.appendChild(b);
      });
      stepArea.appendChild(fb);
    }

    renderStep();
  }

  root.Tsim = { render: render };
})(this);
