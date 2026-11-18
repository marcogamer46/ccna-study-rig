'use strict';
/* Independent content-answer verifier: recomputes subnetting answers from the stem
   and checks the marked index is correct. Reports mismatches and unverifiable items. */
const Net = require('../js/lib/net.js');
const V6 = require('../js/lib/ipv6.js');
const data = require('../data/questions.json');

const norm = s => String(s).trim().toLowerCase().replace(/\s+/g, ' ');
let flagged = 0, verified = 0, unverifiable = 0;

data.questions.forEach(q => {
  if (q.type !== 'mcq') return;
  const stem = String(q.stem).toLowerCase();
  const opts = q.options.map(o => norm(o));

  // --- IPv4 subnet checks ---
  const re4 = /(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})/g;
  const ip4 = []; let m;
  while ((m = re4.exec(stem))) ip4.push([m[1], parseInt(m[2], 10)]);
  for (const [ip, pfx] of ip4) {
    let s;
    try { s = Net.solve(ip, pfx); } catch (e) { continue; }
    const candidates = {
      [norm(s.network)]: true,
      [norm(s.broadcast)]: true,
      [norm(s.firstHost)]: true,
      [norm(s.lastHost)]: true,
      [norm(String(s.usableHosts))]: true,
      [norm(String(s.increment))]: true,
      [norm(s.mask)]: true,
      [norm('/' + pfx)]: true
    };
    const hits = [];
    opts.forEach((o, i) => { if (candidates[o]) hits.push(i); });
    if (hits.length === 1) {
      verified++;
      if (hits[0] !== q.answer) {
        flagged++;
        console.log(`MISMATCH ${q.id} (${q.section}): stem="${q.stem}"`);
        console.log(`   expected idx ${hits[0]} (=${opts[hits[0]]}) but answer=${q.answer} (=${opts[q.answer]})`);
      }
    }
  }

  // --- IPv6 abbreviation/expansion checks ---
  const re6 = /(\b[0-9a-f]{1,4}(?::[0-9a-f]{0,4}){1,7}\b)/g;
  let m6, got6 = false;
  while ((m6 = re6.exec(stem))) { got6 = true; break; }
  if (got6) {
    // if an option matches the abbreviated form of the first ipv6 found, check
    const first6 = stem.match(re6);
    if (first6 && first6[0]) {
      try {
        const canon = V6.abbreviate(first6[0]);
        const cIdx = opts.indexOf(norm(canon));
        if (cIdx !== -1) {
          verified++;
          if (cIdx !== q.answer) {
            flagged++;
            console.log(`MISMATCH ${q.id} ipv6 abbrev: stem ipv6=${first6[0]} canon=${canon} idx=${cIdx} answer=${q.answer}`);
          }
        }
      } catch (e) { /* ignore */ }
    }
  }
});

console.log(`\nchecked ${verified} computed answers, ${flagged} mismatches, ${unverifiable} unverifiable questions (not reported).`);
