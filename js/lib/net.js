/* net.js - IPv4 / subnetting math (pure functions, environment-agnostic).
   Works in the browser (attaches to window.Net) and in Node (module.exports). */
(function (root) {
  'use strict';

  var Net = {};

  /* ---------- conversion ---------- */

  // "192.168.10.5" -> 3232238085 (uint32). Throws on invalid input.
  Net.ipToInt = function (ip) {
    if (typeof ip !== 'string') throw new Error('ip must be a string');
    var parts = ip.trim().split('.');
    if (parts.length !== 4) throw new Error('invalid IPv4: ' + ip);
    var n = 0;
    for (var i = 0; i < 4; i++) {
      var oct = Number(parts[i]);
      if (parts[i] === '' || !isFinite(oct) || oct < 0 || oct > 255 || Math.floor(oct) !== oct) {
        throw new Error('invalid octet in: ' + ip);
      }
      n = (n << 8) | oct;
    }
    return n >>> 0;
  };

  // uint32 -> "a.b.c.d"
  Net.intToIp = function (n) {
    n = n >>> 0;
    return ((n >>> 24) & 255) + '.' + ((n >>> 16) & 255) + '.' + ((n >>> 8) & 255) + '.' + (n & 255);
  };

  Net.toBinary = function (n) {
    n = n >>> 0;
    var groups = [];
    for (var i = 3; i >= 0; i--) {
      var b = ((n >>> (i * 8)) & 255).toString(2);
      while (b.length < 8) b = '0' + b;
      groups.push(b);
    }
    return groups;
  };

  /* ---------- masks / prefixes ---------- */

  Net.maskFromPrefix = function (p) {
    p = Number(p);
    if (isNaN(p) || p < 0 || p > 32 || Math.floor(p) !== p) throw new Error('invalid prefix: ' + p);
    if (p === 0) return 0;
    return (0xFFFFFFFF << (32 - p)) >>> 0;
  };

  // Contiguous mask -> prefix length. Returns null if mask not valid contiguous.
  Net.prefixFromMask = function (mask) {
    mask = mask >>> 0;
    var p = 0;
    var m = mask;
    while (m & 0x80000000) { p++; m <<= 1; }
    if (m !== 0) return null; // non-contiguous / invalid
    return p;
  };

  Net.maskToString = function (mask) { return Net.intToIp(mask); };

  /* ---------- core subnet math ---------- */

  // Logical AND of IP and mask -> network address.
  Net.networkOf = function (ip, prefix) {
    return (Net.ipToInt(ip) & Net.maskFromPrefix(prefix)) >>> 0;
  };

  Net.broadcastOf = function (net, prefix) {
    net = Net.ipToInt(net);
    var mask = Net.maskFromPrefix(prefix);
    return (net | (~mask)) >>> 0;
  };

  // Subnet size (magic number / increment) = 2^hostBits. hostBits = 32 - prefix.
  Net.incrementOf = function (prefix) {
    return Math.pow(2, 32 - prefix);
  };

  Net.hostBitsOf = function (prefix) { return 32 - prefix; };
  Net.usableHostsOf = function (prefix) {
    var h = 32 - prefix;
    return Math.pow(2, h) - 2;
  };

  Net.firstHostNet = function (net) { return (Net.ipToInt(net) + 1) >>> 0; };
  Net.lastHostBc = function (bc) { return (Net.ipToInt(bc) - 1) >>> 0; };

  // Number of subnets obtainable from basePrefix by borrowing to newPrefix.
  Net.subnetsFromBase = function (basePrefix, newPrefix) {
    return Math.pow(2, newPrefix - basePrefix);
  };

  /* ---------- requirement-driven prefix selection ---------- */

  // Smallest newPrefix that yields >= n subnets from basePrefix.
  Net.prefixForSubnets = function (basePrefix, n) {
    n = Number(n);
    if (isNaN(n) || n < 1) throw new Error('invalid subnet count');
    var bits = Math.ceil(Math.log2(Math.max(n, 2)));
    var p = basePrefix + bits;
    if (p > 32) throw new Error('impossible subnet count for /' + basePrefix);
    return p;
  };

  // Smallest prefix that yields >= hosts usable host addresses. h = ceil(log2(hosts+2)).
  Net.prefixForHosts = function (hosts) {
    hosts = Number(hosts);
    if (isNaN(hosts) || hosts < 2) throw new Error('hosts must be >= 2');
    var h = Math.ceil(Math.log2(hosts + 2));
    if (h > 30) throw new Error('too many hosts for a single subnet');
    return 32 - h;
  };

  /* ---------- enumeration ---------- */

  // Enumerate all subnets when carving base network (ip/basePrefix) into newPrefix.
  Net.enumerateSubnets = function (base, basePrefix, newPrefix) {
    var count = Net.subnetsFromBase(basePrefix, newPrefix);
    var inc = Net.incrementOf(newPrefix);
    var start = Net.networkOf(base, basePrefix);
    var out = [];
    for (var i = 0; i < count; i++) {
      var net = (start + i * inc) >>> 0;
      var bc = (net + inc - 1) >>> 0;
      out.push({
        index: i,
        network: Net.intToIp(net),
        firstHost: Net.intToIp((net + 1) >>> 0),
        lastHost: Net.intToIp((bc - 1) >>> 0),
        broadcast: Net.intToIp(bc),
        hosts: Net.usableHostsOf(newPrefix),
        increment: inc
      });
    }
    return out;
  };

  /* ---------- VLSM ---------- */

  // reqs: array of {name, hosts}. Sort largest-first, allocate sequentially with the
  // smallest prefix that fits. Returns {rows, overflow}.
  Net.vlsmAllocate = function (base, basePrefix, reqs) {
    var start = Net.networkOf(base, basePrefix);
    var ordered = reqs.slice().sort(function (a, b) { return b.hosts - a.hosts; });
    var ptr = start;
    var baseInt = start;
    var maxEnd = (start + Math.pow(2, 32 - basePrefix)) >>> 0;
    var rows = [];
    var overflow = false;
    for (var i = 0; i < ordered.length; i++) {
      var req = ordered[i];
      var hosts = Math.max(2, req.hosts);
      var p = Net.prefixForHosts(hosts);
      var inc = Net.incrementOf(p);
      var net = ptr >>> 0;
      var bc = (net + inc - 1) >>> 0;
      var end = (bc + 1) >>> 0;
      if (end > maxEnd) { overflow = true; break; }
      rows.push({
        name: req.name || ('Subnet ' + (i + 1)),
        hostsRequired: req.hosts,
        prefix: p,
        mask: Net.maskToString(Net.maskFromPrefix(p)),
        network: Net.intToIp(net),
        increment: inc,
        firstHost: Net.intToIp((net + 1) >>> 0),
        lastHost: Net.intToIp((bc - 1) >>> 0),
        broadcast: Net.intToIp(bc),
        usable: Net.usableHostsOf(p),
        wasted: Net.usableHostsOf(p) - req.hosts
      });
      ptr = end;
    }
    return { rows: rows, overflow: overflow, initial: baseInt, basePrefix: basePrefix };
  };

  /* ---------- worked-solution narrative (magic number method) ---------- */

  // Build a step-by-step explanation object for subnetting ip/prefix.
  Net.solve = function (ip, prefix) {
    var ipInt = Net.ipToInt(ip);
    var mask = Net.maskFromPrefix(prefix);
    var netInt = (ipInt & mask) >>> 0;
    var bcInt = (netInt | (~mask)) >>> 0;
    var inc = Net.incrementOf(prefix);
    var h = Net.hostBitsOf(prefix);
    return {
      ip: ip,
      prefix: prefix,
      mask: Net.maskToString(mask),
      maskInt: mask,
      network: Net.intToIp(netInt),
      broadcast: Net.intToIp(bcInt),
      firstHost: Net.intToIp((netInt + 1) >>> 0),
      lastHost: Net.intToIp((bcInt - 1) >>> 0),
      increment: inc,
      hostBits: h,
      usableHosts: Net.usableHostsOf(prefix),
      binary: {
        ip: Net.toBinary(ipInt),
        mask: Net.toBinary(mask),
        network: Net.toBinary(netInt)
      },
      magicNote: 'Host bits = 32 - /' + prefix + ' = ' + h + '. Block size (magic number) = 2^' + h + ' = ' + inc + '. ' +
        'This is also 256 - ' + Net.intToIp(mask).split('.').pop() + ' when the change is inside the last octet.'
    };
  };

  // Does this prefix sit on an octet boundary (host bits are a multiple of 8)?
  Net.isOctetBoundary = function (prefix) { return (32 - prefix) % 8 === 0; };

  /* ---------- random problem generator (for trainers) ---------- */

  // difficulty: 'octets' (base /8,/16 -> cross-octet), otherwise within one octet.
  Net.randomProblem = function (difficulty) {
    var basePrefix;
    if (difficulty === 'octets') {
      basePrefix = Math.random() < 0.5 ? 16 : 8;
    } else {
      basePrefix = 24;
    }
    // pick host bits 3..9 (increment 8..512) so subnets are enumerable
    var hostBits = 3 + Math.floor(Math.random() * 7);
    var newPrefix = 32 - hostBits;
    if (newPrefix <= basePrefix) newPrefix = basePrefix + Math.max(1, hostBits - (32 - basePrefix) + 1);
    // pick an aligned random network within a plausible space
    var inc = Net.incrementOf(newPrefix);
    var maxN = Math.floor(16777216 / inc); // keep within 16M address space
    var n = 1 + Math.floor(Math.random() * Math.min(256, maxN));
    var net = n * inc;
    // choose a host IP inside this subnet (between network+1 and broadcast-1)
    var hostOffset = 1 + Math.floor(Math.random() * Math.max(1, inc - 2));
    var ip = (net + hostOffset) >>> 0;
    return {
      ip: Net.intToIp(ip),
      prefix: newPrefix,
      basePrefix: basePrefix,
      network: Net.intToIp(net),
      broadcast: Net.intToIp((net + inc - 1) >>> 0),
      firstHost: Net.intToIp((net + 1) >>> 0),
      lastHost: Net.intToIp((net + inc - 2) >>> 0),
      increment: inc,
      usableHosts: inc - 2,
      subnetsFromBase: Math.pow(2, newPrefix - basePrefix)
    };
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = Net; }
  else { root.Net = Net; }
})(this);
