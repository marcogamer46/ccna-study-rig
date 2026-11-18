/* learn.js - a short guided "Learn" walkthrough.
   The point: build the *picture* before any drilling. Three steps, in order:
   1. The picture (address + mask + network/host, with live highlight)
   2. The words (one-line definitions of the handful of terms used everywhere)
   3. The trick (magic number: block size drives all counting)
   Nothing here adds new math — it reuses the verified Net/V6 engine.
*/
(function (root) {
  'use strict';
  var U = root.U, Net = root.Net;

  function render(el) {
    el.innerHTML = '';
    el.appendChild(U.el('h2', { class: 'view-title' }, 'Learn'));
    el.appendChild(U.el('p', { class: 'view-sub' }, 'Two minutes, in order. Press Next when each step makes sense.'));

    var box = U.el('div', { class: 'card' });
    var steps = ['The picture', 'The words', 'The trick'];
    var idx = 0;
    function nav(footer) {
      var row = U.el('div', { class: 'btnrow', style: 'margin-top:14px' });
      if (idx > 0) row.appendChild(U.el('button', { class: 'btn', onclick: function () { show(idx - 1); } }, '← Back'));
      if (idx < steps.length - 1) row.appendChild(U.el('button', { class: 'btn primary', onclick: function () { show(idx + 1); } }, 'Next →'));
      else row.appendChild(U.el('button', { class: 'btn primary', onclick: function () { location.hash = '#/trainers'; } }, 'Start practicing →'));
      footer.appendChild(row);
    }
    function show(i) {
      idx = i;
      box.innerHTML = '';
      var title = U.el('h3', { class: 'step-title', style: 'margin-bottom:10px' }, (i + 1) + '. ' + steps[i]);
      box.appendChild(title);
      if (i === 0) step1(box);
      else if (i === 1) step2(box);
      else step3(box);
      nav(box);
    }
    show(0);

    /* ---- step 1: the picture ---- */
    function step1(c) {
      c.appendChild(U.el('p', null, 'An IPv4 address is like a <b>street + house number</b>. The part that does not change for everyone nearby is the <b>network</b>; the last part is the <b>host</b>.'));

      var ipIn = U.el('input', { type: 'text', value: '192.168.1.130', style: 'width:9em' });
      var pfx = 26;
      var pfxIn = U.el('input', { type: 'number', min: '16', max: '30', value: String(pfx), style: 'width:4.5em' });
      var pfxUp = U.el('button', { class: 'btn sm', type: 'button' }, '+');
      var pfxDn = U.el('button', { class: 'btn sm', type: 'button' }, '−');
      var viz = U.el('div', { class: 'octet-row' });
      var sentence = U.el('p', { class: 'learn-sentence' });
      var neigh = U.el('div', { class: 'card inner' });

      function paint() {
        var ip = ipIn.value.trim(), p = parseInt(pfxIn.value, 10);
        if (isNaN(p)) p = 26;
        if (p < 16) p = 16; else if (p > 30) p = 30;
        pfxIn.value = String(p);
        try {
          var s = Net.solve(ip, p);
          var octets = ip.split('.');
          var maskOctets = s.mask.split('.');
          viz.innerHTML = '';
          octets.forEach(function (o, i) {
            var cls = 'host';
            if (maskOctets[i] === '255') cls = 'net';
            else if (maskOctets[i] !== '0') cls = 'mix';
            viz.appendChild(U.el('span', { class: 'octet ' + cls }, o));
          });
          viz.appendChild(U.el('span', { class: 'octet lbl' }, '/ ' + p));
          var hostValue = Net.ipToInt(ip) - Net.ipToInt(s.network); // offset inside the subnet
          sentence.innerHTML = 'Your device lives on <b>' + U.esc(s.network) + '</b>, as <b>house number ' + hostValue + '</b>. Mask ' + U.esc(s.mask) +
            ' — blue octets are the street, grey are yours; a half-blue octet holds both.';

          // neighbor test
          var trials = [ip, s.network, s.broadcast];
          var otherIp = (function () {
            var base = octets.slice();
            base[3] = String(parseInt(base[3], 10) + 37) % 256; // arbitrary different last octet
            if (base[3] === octets[3]) base[3] = String((parseInt(base[3], 10) + 1) % 256);
            return base.join('.');
          })();
          var other = Net.solve(otherIp, p);
          var same = other.network === s.network;
          neigh.innerHTML = '';
          neigh.appendChild(U.el('p', null, 'Compare with a neighbour at <code>' + U.esc(otherIp) + '</code>:'));
          neigh.appendChild(U.el('p', { class: 'learn-sentence' },
            same
              ? 'Same network (' + U.esc(s.network) + ') → they are <b>local</b>; talk directly, no router needed.'
              : 'Different network (' + U.esc(other.network) + ' vs ' + U.esc(s.network) + ') → you need a <b>router/gateway</b> to reach them.'));
        } catch (e) {
          viz.innerHTML = '';
          sentence.innerHTML = U.esc(e.message);
          neigh.innerHTML = '';
        }
      }

      ipIn.addEventListener('input', paint);
      pfxIn.addEventListener('input', paint);
      pfxUp.addEventListener('click', function () { pfxIn.value = String(Math.min(30, parseInt(pfxIn.value, 10) + 1)); paint(); });
      pfxDn.addEventListener('click', function () { pfxIn.value = String(Math.max(16, parseInt(pfxIn.value, 10) - 1)); paint(); });

      c.appendChild(U.el('p', null, 'IP address ', ipIn, ' &nbsp; mask / ', pfxIn, ' ', pfxDn, pfxUp));
      c.appendChild(viz);
      c.appendChild(sentence);
      c.appendChild(neigh);
      c.appendChild(U.el('p', { class: 'view-sub' }, 'Slide the mask up/down and watch the “street” (network) shrink or grow.'));
      paint();
    }

    /* ---- step 2: the words ---- */
    function step2(c) {
      var rows = [
        ['IP address', 'The full address, e.g. 192.168.1.130 — street + house number.'],
        ['Subnet mask', 'A second number that tells you which part is the street and which is the house. Written like 255.255.255.192.'],
        ['Prefix length', 'A shorthand way to write the mask: just the number of 1-bits. /26 means 26 bits of network.'],
        ['Network address', 'The start of your street. The first address in the block. Ends in the “magic” number (0, 64, 128, 192…).'],
        ['Broadcast address', 'The last address in the block. It talks to everyone on the street at once. Cannot be used by a device.'],
        ['First / last usable host', 'Just after the network (network + 1) and just before the broadcast (broadcast − 1). These are the addresses devices actually use.'],
        ['Usable hosts', 'How many devices can live on this street: 2^hostbits − 2 (minus network and broadcast).'],
        ['Gateway', 'The router that connects your street to the rest of the internet. Usually the first usable host.'],
        ['Local vs remote', 'Same network = local (talk right to the device). Different network = remote (must go through the gateway).']
      ];
      c.appendChild(U.table({ headers: ['Term', 'In one line'], rows: rows }, {}));
      c.appendChild(U.el('p', { class: 'view-sub' }, 'You will only ever meet these few words. If a screen uses one you don’t recall, it’s here.'));
    }

    /* ---- step 3: the trick ---- */
    function step3(c) {
      c.appendChild(U.el('p', null, 'All subnetting boils down to ONE number: the <b>block size</b> (the “magic number”). Once you know it, everything else is just adding and subtracting.'));

      var rows = [];
      [26, 27, 28, 29, 30].forEach(function (pf) {
        var s = Net.solve('192.168.1.0', pf);
        rows.push(['/' + pf, s.mask.split('.').pop(), s.increment, s.usableHosts]);
      });
      c.appendChild(U.table({ headers: ['Prefix', 'Mask (last octet)', 'Block size', 'Usable hosts'], rows: rows }, {}));
      c.appendChild(U.el('p', null, 'Block size = 256 − last mask octet. For /26: 256 − 192 = <b>64</b>. Network starts are 0, 64, 128, 192 — adding 64 each time.'));
      c.appendChild(U.el('div', { class: 'card inner' },
        U.el('h4', null, 'Worked example: 192.168.1.130/26'),
        U.el('p', null, 'Mask ends in 192 → block = 256 − 192 = 64. The address sits in the block that starts at 128 (128 + 64 = 192, and 130 is between). So:'),
        U.table({
          headers: ['', 'Value'],
          rows: [
            ['Network', '192.168.1.128'],
            ['First usable', '192.168.1.129'],
            ['Last usable', '192.168.1.190'],
            ['Broadcast', '192.168.1.191'],
            ['Usable hosts', '62']
          ]
        }, {}),
        U.el('p', { class: 'view-sub' }, 'That’s it. The subnet drill on the Practice tab asks you to rebuild exactly this, one box at a time.')));
    }
  }

  root.Learn = { render: render };
})(this);
