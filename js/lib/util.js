/* util.js - tiny DOM/format helpers (attaches to window.U). */
(function (root) {
  'use strict';
  var U = {};

  U.$ = function (sel, scope) { return (scope || document).querySelector(sel); };
  U.$$ = function (sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); };
  U.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  // Create an element: U.el('div', {class:'x', onclick:fn}, childOrText...)
  U.el = function (tag, attrs) {
    var node = document.createElement(tag);
    var children = Array.prototype.slice.call(arguments, 2);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
        else if (v != null) node.setAttribute(k, v);
      });
    }
    children.forEach(function (c) {
      if (c == null) return;
      if (c.nodeType) node.appendChild(c);
      else node.appendChild(document.createTextNode(String(c)));
    });
    return node;
  };

  // Normalize a typed command for comparison: lowercase, collapse whitespace.
  U.normCmd = function (s) {
    return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  };

  // Render a data table {headers, rows} as an HTML <table>.
  U.table = function (tbl, opts) {
    opts = opts || {};
    var table = U.el('table', { class: 'data-table' });
    if (tbl.headers) {
      var thead = U.el('thead');
      var hr = U.el('tr');
      tbl.headers.forEach(function (h) { hr.appendChild(U.el('th', null, h)); });
      thead.appendChild(hr);
      table.appendChild(thead);
    }
    var tbody = U.el('tbody');
    (tbl.rows || []).forEach(function (row) {
      var tr = U.el('tr');
      row.forEach(function (cell, i) {
        if (opts.monoCells && opts.monoCells.indexOf(i) !== -1) {
          tr.appendChild(U.el('td', null, U.el('code', null, cell)));
        } else {
          tr.appendChild(U.el('td', null, cell));
        }
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  };

  // Collapsible block: U.collapse(title, contentNode, open)
  U.collapse = function (title, contentNode, open) {
    var body = U.el('div', { class: 'collapse-body' });
    var inner = U.el('div', { class: 'collapse-inner' });
    inner.appendChild(contentNode);
    body.appendChild(inner);
    var head = U.el('button', { class: 'collapse-head', type: 'button' },
      U.el('span', { class: 'collapse-caret' }, open ? '▾' : '▸'),
      U.el('span', { class: 'collapse-title' }, title));
    var wrap = U.el('div', { class: 'collapse' + (open ? ' open' : '') }, head, body);
    head.addEventListener('click', function () {
      var isOpen = wrap.classList.toggle('open');
      head.querySelector('.collapse-caret').textContent = isOpen ? '▾' : '▸';
    });
    return wrap;
  };

  U.toggleInput = function (label, checked, onChange) {
    var cb = U.el('input', { type: 'checkbox', class: 'toggle' });
    cb.checked = !!checked;
    cb.addEventListener('change', function () { onChange(cb.checked); });
    return U.el('label', { class: 'toggle-label' }, cb, ' ', label);
  };

  root.U = U;
})(this);
