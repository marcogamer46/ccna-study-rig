/* flashcards.js - Leitner spaced repetition. Attaches to window.Flashcards. */
(function (root) {
  'use strict';
  var U = root.U, Progress = root.Progress;

  var state = null; // {pool, i, flipped, mode}

  function shuffle(a) { var arr = a.slice(); for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }

  function render(el) {
    el.innerHTML = '';
    el.appendChild(U.el('h2', { class: 'view-title' }, 'Flashcards'));
    el.appendChild(U.el('p', { class: 'view-sub' },
      'Leitner boxes: boxes advance on “Good”, reset to box 0 on “Again”. Space flips, ← = Again, → = Good.'));

    var modeSel = U.el('select', null,
      U.el('option', { value: 'due' }, 'Due now (spaced repetition)'),
      U.el('option', { value: 'all' }, 'All cards'));
    var startBtn = U.el('button', { class: 'btn primary' }, 'Start session');

    // box distribution
    var dist = U.el('div', { class: 'grid cols2' });
    var boxCounts = [0, 0, 0, 0, 0];
    App.data.flashcards.forEach(function (c) { boxCounts[Progress.boxOf(c.id)]++; });
    var distRows = boxCounts.map(function (n, b) {
      return ['Box ' + b + ' (' + (b === 0 ? 'new/hard' : Progress.intervalForBox(b) + 'd') + ')', n];
    });
    dist.appendChild(U.el('div', { class: 'card' },
      U.el('h3', null, 'Box distribution'),
      U.table({ headers: ['Box', 'Cards'], rows: distRows }, {})));

    var cardWrap = U.el('div', { class: 'fc-stage' });
    el.appendChild(U.el('div', { class: 'grid cols2' },
      U.el('div', { class: 'card' },
        U.el('div', { class: 'field' }, U.el('label', null, 'Session'), U.el('div', null, modeSel)),
        U.el('div', { class: 'btnrow' }, startBtn)),
      dist));
    el.appendChild(cardWrap);

    startBtn.addEventListener('click', function () {
      var pool = App.data.flashcards.filter(function (c) {
        return modeSel.value === 'all' || Progress.isDue(c.id);
      });
      if (!pool.length) {
        cardWrap.innerHTML = '';
        cardWrap.appendChild(U.el('div', { class: 'feedback info' }, 'Nothing due right now. Switch to “All cards” or answer some “Again” cards.'));
        return;
      }
      state = { pool: shuffle(pool), i: 0, flipped: false };
      renderCard(cardWrap);
    });
  }

  function renderCard(wrap) {
    wrap.innerHTML = '';
    if (state.i >= state.pool.length) {
      wrap.appendChild(U.el('div', { class: 'feedback ok' },
        '<b>Session done.</b> ' + state.pool.length + ' card(s) reviewed. Keep going — boxes drift up with repetition.'));
      return;
    }
    var card = state.pool[state.i];
    var box = Progress.boxOf(card.id);

    var fcCard = U.el('div', { class: 'fc-card' });
    var inner = U.el('div', { class: 'fc-inner' });
    var front = U.el('div', { class: 'fc-face' }, card.front);
    var back = U.el('div', { class: 'fc-face fc-back' }, card.back);
    inner.appendChild(front); inner.appendChild(back);
    fcCard.appendChild(inner);

    var meta = U.el('div', { class: 'fc-count' },
      'Card ' + (state.i + 1) + ' / ' + state.pool.length +
      ' · Box <b>' + box + '</b>');
    var tags = U.el('div', { class: 'fc-tags' });
    (card.tags || []).forEach(function (t) { tags.appendChild(U.el('span', { class: 'badge' }, t)); });
    meta.appendChild(tags);

    var againBtn = U.el('button', { class: 'btn', style: 'display:none' }, 'Again (hard)');
    var goodBtn = U.el('button', { class: 'btn primary', style: 'display:none' }, 'Good');
    var controls = U.el('div', { class: 'fc-controls' }, againBtn, goodBtn);

    fcCard.addEventListener('click', function () { flip(); });
    function flip() {
      state.flipped = !state.flipped;
      fcCard.classList.toggle('flipped', state.flipped);
      againBtn.style.display = state.flipped ? 'inline-block' : 'none';
      goodBtn.style.display = state.flipped ? 'inline-block' : 'none';
    }
    function answer(good) {
      if (!state.flipped) { flip(); return; } // must flip first
      if (good) Progress.promote(card.id); else Progress.demote(card.id);
      state.i++;
      state.flipped = false;
      renderCard(wrap);
    }
    againBtn.addEventListener('click', function () { answer(false); });
    goodBtn.addEventListener('click', function () { answer(true); });

    document.onkeydown = function (e) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
      else if (e.key === 'ArrowLeft') answer(false);
      else if (e.key === 'ArrowRight') answer(true);
    };

    wrap.appendChild(meta);
    wrap.appendChild(fcCard);
    wrap.appendChild(controls);
  }

  root.Flashcards = { render: render };
})(this);
