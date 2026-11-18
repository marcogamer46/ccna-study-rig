/* progress.js - localStorage persistence + Leitner state. Attaches to window.Progress. */
(function (root) {
  'use strict';

  var KEY = 'ccna-study-v1';
  var INTERVALS = [0, 1, 3, 7, 14]; // days per box 0..4
  var DAY = 86400000;

  var empty = function () {
    return {
      version: 1,
      theme: 'dark',
      sectionsDone: {},
      quiz: {},            // { "11": {taken, correct} }
      weak: {},            // { tag: misses }
      boxes: {},           // cardId -> box 0..4
      due: {},             // cardId -> timestamp
      tsimDone: {}         // scenarioId -> true
    };
  };

  var state = empty();

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        state = Object.assign(empty(), parsed);
      }
    } catch (e) { /* corrupted -> reset */ }
    return state;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* quota/blocked */ }
  }

  function setTheme(t) { state.theme = t; save(); }

  // --- sections ---
  function markSection(id) { state.sectionsDone[id] = true; save(); }
  function isSectionDone(id) { return !!state.sectionsDone[id]; }

  // --- quiz ---
  function recordQuiz(moduleId, correct, total, wrongTags) {
    var m = state.quiz[moduleId] || { taken: 0, correct: 0 };
    m.taken += total; m.correct += correct;
    state.quiz[moduleId] = m;
    (wrongTags || []).forEach(function (tag) {
      state.weak[tag] = (state.weak[tag] || 0) + 1;
    });
    save();
  }

  // --- flashcards (Leitner) ---
  function boxOf(id) { return state.boxes[id] || 0; }
  function isDue(id) {
    var d = state.due[id];
    if (d == null) return true;
    return Date.now() >= d;
  }
  function promote(id) {
    var b = Math.min(4, boxOf(id) + 1);
    state.boxes[id] = b;
    state.due[id] = Date.now() + INTERVALS[b] * DAY;
    save();
  }
  function demote(id) {
    state.boxes[id] = 0;
    state.due[id] = Date.now();
    save();
  }
  function intervalForBox(b) { return INTERVALS[b] || 0; }

  // --- troubleshooting sim ---
  function tsimDone(id) { return !!state.tsimDone[id]; }
  function setTsimDone(id) { state.tsimDone[id] = true; save(); }

  // --- export / import ---
  function exportJSON() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ccna-study-progress.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function importJSON(str) {
    try {
      var parsed = JSON.parse(str);
      state = Object.assign(empty(), parsed);
      save();
      return true;
    } catch (e) { return false; }
  }

  // --- "study next" suggestion ---
  function studyNext() {
    // lowest module accuracy gets suggested
    var best = null, bestPct = 1.01;
    ['11', '12', '17'].forEach(function (id) {
      var m = state.quiz[id];
      if (m && m.taken > 0) {
        var pct = m.correct / m.taken;
        if (pct < bestPct) { bestPct = pct; best = id; }
      } else if (!m) {
        best = best || id; bestPct = 0;
      }
    });
    var weak = Object.keys(state.weak).sort(function (a, b) { return state.weak[b] - state.weak[a]; }).slice(0, 5);
    return { module: best, weak: weak };
  }

  root.Progress = {
    load: load, save: save, state: state, setTheme: setTheme,
    markSection: markSection, isSectionDone: isSectionDone,
    recordQuiz: recordQuiz,
    boxOf: boxOf, isDue: isDue, promote: promote, demote: demote, intervalForBox: intervalForBox,
    tsimDone: tsimDone, setTsimDone: setTsimDone,
    exportJSON: exportJSON, importJSON: importJSON,
    studyNext: studyNext
  };
})(this);
