/* ipv6.js - IPv6 helpers (pure functions, environment-agnostic). */
(function (root) {
  'use strict';

  var V6 = {};

  /* ---------- parsing ---------- */

  // Parse any IPv6 textual form to 8 hextets (lowercase, 4 chars, zero-padded).
  V6.parseFull = function (addr) {
    if (typeof addr !== 'string' || !addr.trim()) throw new Error('invalid IPv6: ' + addr);
    var s = addr.trim().toLowerCase();
    var tokens;
    if (s.indexOf('::') !== -1) {
      var halves = s.split('::');
      if (halves.length > 2) throw new Error('invalid IPv6: ' + addr);
      if (halves[0].length && halves[0].charAt(halves[0].length - 1) === ':') throw new Error('invalid IPv6: ' + addr);
      if (halves[1] && halves[1].charAt(0) === ':') throw new Error('invalid IPv6: ' + addr);
      var l = halves[0] ? halves[0].split(':').filter(function (x) { return x !== ''; }) : [];
      var r = halves[1] ? halves[1].split(':').filter(function (x) { return x !== ''; }) : [];
      var missing = 8 - l.length - r.length;
      if (missing < 1) throw new Error('invalid IPv6: ' + addr);
      tokens = l.concat(new Array(missing).fill('0'), r);
    } else {
      tokens = s.split(':');
    }
    if (tokens.length !== 8) throw new Error('invalid IPv6: ' + addr);
    return tokens.map(function (t) {
      if (!/^[0-9a-f]{1,4}$/.test(t)) throw new Error('invalid hextet: ' + t);
      while (t.length < 4) t = '0' + t;
      return t;
    });
  };

  V6.expand = function (addr) {
    return V6.parseFull(addr).join(':');
  };

  /* ---------- abbreviation (RFC 5952) ---------- */

  // Strip leading zeros, keep at least one digit.
  function stripLeadingZeros(t) {
    var stripped = t.replace(/^0+/, '');
    return stripped === '' ? '0' : stripped;
  }

  // The canonical shortest form: lowercase, omit leading zeros, compress the LONGEST
  // run of zero hextets (length >= 2) to '::'; on ties, compress the leftmost.
  V6.abbreviate = function (addr) {
    var full = V6.parseFull(addr);
    var stripped = full.map(stripLeadingZeros);
    // find longest run of "0" hextets >= 2
    var bestStart = -1, bestLen = 0, i = 0;
    while (i < 8) {
      if (stripped[i] === '0') {
        var j = i;
        while (j < 8 && stripped[j] === '0') j++;
        var len = j - i;
        if (len >= 2 && len > bestLen) { bestLen = len; bestStart = i; }
        i = j;
      } else { i++; }
    }
    if (bestStart < 0) return stripped.join(':');
    var left = stripped.slice(0, bestStart).join(':');
    var right = stripped.slice(bestStart + bestLen).join(':');
    return left + '::' + right;
  };

  /* ---------- EUI-64 ---------- */

  // MAC -> interface ID with the U/L bit flip. Accepts 00:11:22:33:44:55,
  // 0011.2233.4455, or dash-separated. Returns details for highlighting.
  V6.macToEui64 = function (mac) {
    if (typeof mac !== 'string') throw new Error('invalid MAC');
    var cleaned = mac.trim().replace(/[-.]/g, ':');
    var parts = cleaned.split(':').filter(function (x) { return x !== ''; });
    var bytes = [];
    var i;
    for (i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (!/^[0-9a-f]{2,4}$/i.test(p)) throw new Error('invalid MAC: ' + mac);
      if (p.length === 4) { bytes.push(parseInt(p.slice(0, 2), 16), parseInt(p.slice(2, 4), 16)); }
      else { bytes.push(parseInt(p, 16)); }
    }
    if (bytes.length !== 6) throw new Error('MAC must have 6 octets: ' + mac);
    if (bytes.some(function (b) { return b < 0 || b > 255; })) throw new Error('invalid MAC octet');
    var flippedOld = bytes[0];
    var flippedNew = bytes[0] ^ 0x02;          // U/L = 2nd-least-significant bit of first octet
    var eui = [flippedNew, bytes[1], bytes[2], 0xff, 0xfe, bytes[3], bytes[4], bytes[5]];
    var hex = function (b) { return (b < 16 ? '0' : '') + b.toString(16); };
    var groups = [];
    for (i = 0; i < 8; i += 2) groups.push(hex(eui[i]) + hex(eui[i + 1]));
    return {
      macLow: mac.trim(),
      bytes: bytes,
      flippedOld: flippedOld,
      flippedNew: flippedNew,
      flippedOldHex: hex(flippedOld),
      flippedNewHex: hex(flippedNew),
      interfaceId: groups.join(':'),
      inserted: 'FF:FE' // between the 3rd and 4th octets
    };
  };

  /* ---------- classification ---------- */

  V6.classify = function (addr) {
    var full = V6.parseFull(addr);
    var h0 = full[0];
    var isMulticast = h0.slice(0, 2) === 'ff';
    var type, group = null, note = '';

    if (full.every(function (t) { return t === '0000'; })) {
      type = 'Unspecified (::)';
      note = 'Used as a source when a host has not yet obtained an address. Cannot be a destination.';
    } else if (h0 === '0000' && full[1] === '0000' && full[2] === '0000' && full[3] === '0000' &&
               full[4] === '0000' && full[5] === '0000' && full[6] === '0000' && full[7] === '0001') {
      type = 'Loopback (::1)';
      note = 'The loopback address. Equivalent to 127.0.0.1 in IPv4.';
    } else if (isMulticast) {
      if (h0 === 'ff02' && full[1] === '0000' && full[2] === '0000' && full[3] === '0000' &&
          full[4] === '0000' && full[5] === '0001' && full[6].slice(0, 2) === 'ff') {
        type = 'Solicited-node multicast';
        note = 'ff02::1:ff00:0/104. Used for IPv6 Neighbor Discovery; derived from the last 24 bits of the target address.';
      } else {
        type = 'Multicast (ff00::/8)';
        if (h0 === 'ff02') {
          if (full[7] === '0001' && full.slice(1, 7).every(function (t) { return t === '0000'; })) { group = 'all-nodes (ff02::1)'; }
          else if (full[7] === '0002' && full.slice(1, 7).every(function (t) { return t === '0000'; })) { group = 'all-routers (ff02::2)'; }
          else if (full[7] === '0005' && full.slice(1, 7).every(function (t) { return t === '0000'; })) { group = 'OSPF (ff02::5)'; }
          else if (full[7] === '0009' && full.slice(1, 7).every(function (t) { return t === '0000'; })) { group = 'RIPng (ff02::9)'; }
          else if (full[7] === '000a' && full.slice(1, 7).every(function (t) { return t === '0000'; })) { group = 'EIGRP (ff02::a)'; }
        }
        note = 'One-to-many. Link-local multicast scope is ff02::/16.';
      }
    } else {
      var first = parseInt(h0, 16);
      if (first >= 0xfe80 && first <= 0xfebf) {
        type = 'Link-local unicast (fe80::/10)';
        note = 'Automatically assigned to every interface; never routed past the local link.';
      } else if (first >= 0xfc00 && first <= 0xfdff) {
        type = 'Unique-local unicast (fc00::/7, ULA)';
        note = 'Like RFC 1918 IPv4: private, for internal networks, not routable on the public Internet.';
      } else if (first >= 0x2000 && first <= 0x3fff) {
        type = 'Global unicast (2000::/3, GUA)';
        note = 'Globally routable, similar to public IPv4. NOTE: an anycast address has the same format as a unicast address - it cannot be identified by the address alone; only the intended use distinguishes it.';
      } else {
        type = 'Other / reserved';
        note = 'Outside the common assigned ranges covered in this module.';
      }
    }
    return { type: type, group: group, note: note, hextets: full };
  };

  // Solicited-node multicast for a target IPv6 address.
  V6.solicitedNode = function (addr) {
    var full = V6.parseFull(addr);
    var lowByte = parseInt(full[6], 16) & 0xff;
    var lb = (lowByte < 16 ? '0' : '') + lowByte.toString(16);
    return 'ff02::1:ff' + lb + ':' + full[7];
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = V6; }
  else { root.V6 = V6; }
})(this);
