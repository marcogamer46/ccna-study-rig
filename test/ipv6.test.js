'use strict';
const V6 = require('../js/lib/ipv6.js');
const assert = require('assert');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; }
  catch (e) { console.error('FAIL: ' + name + '\n  ' + e.message); process.exitCode = 1; }
}

t('abbreviate: full form', () => {
  assert.strictEqual(V6.abbreviate('2001:0db8:0000:0000:0000:0000:0000:0001'), '2001:db8::1');
});

t('abbreviate: omit leading zeros, compress longest run', () => {
  assert.strictEqual(V6.abbreviate('2001:0db8:0000:0000:0000:ff00:0042:8329'), '2001:db8::ff00:42:8329');
});

t('abbreviate: compress longest run of two candidates', () => {
  // runs: idx1-2 (len2) and idx4-6 (len3) -> compress the longer one
  assert.strictEqual(V6.abbreviate('2001:0:0:1:0:0:0:1'), '2001:0:0:1::1');
});

t('abbreviate: tie -> leftmost', () => {
  // runs idx1-2 and idx4-5 both length 2 -> leftmost wins
  assert.strictEqual(V6.abbreviate('2001:0:0:1:0:0:1:1'), '2001::1:0:0:1:1');
});

t('abbreviate: single zero hextet is NOT compressed', () => {
  assert.strictEqual(V6.abbreviate('2001:0:1:2:3:4:5:6'), '2001:0:1:2:3:4:5:6');
});

t('abbreviate: lowercase and roundtrip', () => {
  assert.strictEqual(V6.abbreviate('2001:0DB8:0:0:0:0:0:1'), '2001:db8::1');
});

t('expand: double colons', () => {
  assert.strictEqual(V6.expand('::1'), '0000:0000:0000:0000:0000:0000:0000:0001');
  assert.strictEqual(V6.expand('2001:db8::1'), '2001:0db8:0000:0000:0000:0000:0000:0001');
  assert.strictEqual(V6.expand('::'), '0000:0000:0000:0000:0000:0000:0000:0000');
});

t('EUI-64: bit-flip highlighted value (spec style)', () => {
  const r = V6.macToEui64('00:1C:42:AB:CD:EF');
  assert.strictEqual(r.flippedOld, 0x00);   // U/L bit 0 -> 1
  assert.strictEqual(r.flippedNew, 0x02);
  assert.strictEqual(r.flippedOldHex, '00');
  assert.strictEqual(r.flippedNewHex, '02');
  assert.strictEqual(r.interfaceId, '021c:42ff:feab:cdef');
});

t('EUI-64: second example', () => {
  assert.strictEqual(V6.macToEui64('00:15:5d:aa:bb:cc').interfaceId, '0215:5dff:feaa:bbcc');
});

t('EUI-64: dotted hex form', () => {
  assert.strictEqual(V6.macToEui64('001c.42ab.cdef').interfaceId, '021c:42ff:feab:cdef');
});

t('classify: loopback and unspecified', () => {
  assert.ok(V6.classify('::1').type.includes('Loopback'));
  assert.ok(V6.classify('::').type.includes('Unspecified'));
});

t('classify: link-local, ULA, GUA', () => {
  assert.ok(V6.classify('fe80::1').type.includes('Link-local'));
  assert.ok(V6.classify('fc00::1234').type.includes('Unique-local'));
  assert.ok(V6.classify('fd00::1').type.includes('Unique-local'));
  assert.ok(V6.classify('2001:db8::1').type.includes('Global unicast'));
  assert.ok(V6.classify('2001:db8::1').note.includes('anycast'));
});

t('classify: multicast well-known', () => {
  assert.ok(V6.classify('ff02::1').type.includes('Multicast'));
  assert.strictEqual(V6.classify('ff02::1').group, 'all-nodes (ff02::1)');
  assert.strictEqual(V6.classify('ff02::2').group, 'all-routers (ff02::2)');
  assert.strictEqual(V6.classify('ff02::5').group, 'OSPF (ff02::5)');
  assert.strictEqual(V6.classify('ff02::9').group, 'RIPng (ff02::9)');
  assert.strictEqual(V6.classify('ff02::a').group, 'EIGRP (ff02::a)');
});

t('classify: solicited-node', () => {
  assert.ok(V6.classify('ff02::1:ff34:5678').type.includes('Solicited-node'));
});

t('solicited-node derivation', () => {
  assert.strictEqual(V6.solicitedNode('2001:db8::1234:5678'), 'ff02::1:ff34:5678');
  assert.strictEqual(V6.solicitedNode('fe80::cafe:1234'), 'ff02::1:fffe:1234');
});

t('invalid input rejected', () => {
  assert.throws(() => V6.parseFull('2001:db8:::1'));
  assert.throws(() => V6.parseFull('zzzz::1'));
  assert.throws(() => V6.macToEui64('00:11:22:33:44'));
});

console.log('ipv6.test.js: ' + passed + ' checks passed');
