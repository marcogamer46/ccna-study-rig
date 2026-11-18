'use strict';
const Net = require('../js/lib/net.js');
const assert = require('assert');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; }
  catch (e) { console.error('FAIL: ' + name + '\n  ' + e.message); process.exitCode = 1; }
}

t('ipToInt/intToIp roundtrip', () => {
  assert.strictEqual(Net.intToIp(Net.ipToInt('192.168.2.10')), '192.168.2.10');
  assert.strictEqual(Net.ipToInt('192.168.10.0'), 3232238080);
  assert.strictEqual(Net.ipToInt('255.255.255.255'), 0xFFFFFFFF);
  assert.throws(() => Net.ipToInt('192.168.1.999'));
  assert.throws(() => Net.ipToInt('192.168.1'));
});

t('mask/prefix roundtrip', () => {
  assert.strictEqual(Net.maskToString(Net.maskFromPrefix(24)), '255.255.255.0');
  assert.strictEqual(Net.maskToString(Net.maskFromPrefix(26)), '255.255.255.192');
  assert.strictEqual(Net.prefixFromMask(Net.maskFromPrefix(16)), 16);
  assert.strictEqual(Net.prefixFromMask(Net.maskFromPrefix(0)), 0);
  assert.strictEqual(Net.prefixFromMask(0xFFFFFF00), 24);
});

t('192.168.10.0/26 -> 4 subnets, 62 hosts, increment 64 (spec case)', () => {
  assert.strictEqual(Net.subnetsFromBase(24, 26), 4);
  assert.strictEqual(Net.usableHostsOf(26), 62);
  assert.strictEqual(Net.incrementOf(26), 64);
  const subs = Net.enumerateSubnets('192.168.10.0', 24, 26);
  assert.strictEqual(subs.length, 4);
  assert.strictEqual(subs[0].network, '192.168.10.0');
  assert.strictEqual(subs[0].broadcast, '192.168.10.63');
  assert.strictEqual(subs[1].network, '192.168.10.64');
  assert.strictEqual(subs[1].broadcast, '192.168.10.127');
  assert.strictEqual(subs[3].network, '192.168.10.192');
  assert.strictEqual(subs[3].broadcast, '192.168.10.255');
});

t('192.168.10.130/26 subnet math', () => {
  const s = Net.solve('192.168.10.130', 26);
  assert.strictEqual(s.network, '192.168.10.128');
  assert.strictEqual(s.broadcast, '192.168.10.191');
  assert.strictEqual(s.firstHost, '192.168.10.129');
  assert.strictEqual(s.lastHost, '192.168.10.190');
  assert.strictEqual(s.increment, 64);
  assert.strictEqual(s.usableHosts, 62);
  assert.ok(s.magicNote.includes('64'));
});

t('requirement-driven prefixes', () => {
  assert.strictEqual(Net.prefixForSubnets(24, 4), 26);
  assert.strictEqual(Net.prefixForSubnets(24, 16), 28);
  assert.strictEqual(Net.prefixForHosts(62), 26);
  assert.strictEqual(Net.prefixForHosts(2), 30);
  assert.strictEqual(Net.prefixForHosts(30), 27);
  assert.strictEqual(Net.prefixForHosts(126), 25);
});

t('cross-octet subnetting /16 -> /20', () => {
  const subs = Net.enumerateSubnets('172.16.0.0', 16, 20);
  assert.strictEqual(subs.length, 16);
  assert.strictEqual(subs[0].network, '172.16.0.0');
  assert.strictEqual(subs[0].broadcast, '172.16.15.255');
  assert.strictEqual(subs[1].network, '172.16.16.0');
  assert.strictEqual(subs[1].broadcast, '172.16.31.255');
  assert.strictEqual(subs[15].network, '172.16.240.0');
  assert.strictEqual(subs[15].broadcast, '172.16.255.255');
});

t('VLSM: largest-first order, correct masks, no overflow', () => {
  const res = Net.vlsmAllocate('192.168.10.0', 24, [
    { name: 'Sales', hosts: 60 },
    { name: 'HR', hosts: 30 },
    { name: 'IT', hosts: 10 },
    { name: 'Mgmt', hosts: 2 }
  ]);
  assert.strictEqual(res.overflow, false);
  const pfxs = res.rows.map(r => r.prefix);
  assert.deepStrictEqual(pfxs, [26, 27, 28, 30]);
  assert.deepStrictEqual(res.rows.map(r => r.network), [
    '192.168.10.0', '192.168.10.64', '192.168.10.96', '192.168.10.112'
  ]);
  assert.deepStrictEqual(res.rows.map(r => r.broadcast), [
    '192.168.10.63', '192.168.10.95', '192.168.10.111', '192.168.10.115'
  ]);
  assert.deepStrictEqual(res.rows.map(r => r.wasted), [2, 0, 4, 0]);
});

t('VLSM sorts largest first even if input is unordered', () => {
  const res = Net.vlsmAllocate('192.168.1.0', 24, [
    { name: 'small', hosts: 2 },
    { name: 'big', hosts: 100 }
  ]);
  assert.strictEqual(res.rows[0].name, 'big');
  assert.strictEqual(res.rows[0].prefix, 25);   // 100 hosts -> /25
  assert.strictEqual(res.rows[1].prefix, 30);
});

t('random problem is internally consistent', () => {
  for (let i = 0; i < 200; i++) {
    const p = Net.randomProblem('octets');
    const s = Net.solve(p.ip, p.prefix);
    assert.strictEqual(s.network, p.network);
    assert.strictEqual(s.broadcast, p.broadcast);
    assert.strictEqual(s.firstHost, p.firstHost);
    assert.strictEqual(s.lastHost, p.lastHost);
    assert.strictEqual(s.increment, p.increment);
    assert.ok(p.ip !== p.network && p.ip !== p.broadcast);
  }
});

console.log('net.test.js: ' + passed + ' checks passed');
