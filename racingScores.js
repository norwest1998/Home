const RacingScoring = (() => {
  const NON_SCORING = ["DNS", "DNF", "DSQ"];
  const norm = s => String(s == null ? "" : s).trim().toUpperCase();
  const round2 = n => Math.round(n * 100) / 100;

  function competitors(results) {
    return results.reduce((n, r) => {
      const s = norm(r.status);
      return n + ((s === "DNS" || (!s && Number(r.position) > 0)) ? 1 : 0);
    }, 0);
  }

  function points({ position, status, competitors: c, eligible, weight = 1 }) {
    const E = Number(eligible), C = Number(c), pos = Number(position);
    const w = isFinite(Number(weight)) ? Number(weight) : 1;
    if (!(E > 0) || !(pos > 0) || NON_SCORING.indexOf(norm(status)) > -1) return 0;
    return round2(Math.min(1, C / E) * Math.max(0, E - pos + 1) * w);
  }


  /* ===== Match racing: round robin + knockout ===== */
  const STAGES = ["R32", "R16", "QF", "SF", "F"];
  const sid = x => String(x == null ? "" : x);
  const isDone = m => !!sid(m.winner) && norm(m.status) !== "SCHEDULED";
  const cfgOf = c => { try { return typeof c === "string" ? JSON.parse(c || "{}") : (c || {}); } catch (e) { return {}; } };

  // Stored pointsA/B win (history is not rewritten by config edits); otherwise computed. Byes and sail-offs (TB) score 0.
  function matchPoints(m, cfg = {}) {
    if (!isDone(m) || norm(m.status) === "BYE" || norm(m.stage) === "TB") return { a: 0, b: 0 };
    if (sid(m.pointsA) !== "" && sid(m.pointsB) !== "") return { a: Number(m.pointsA), b: Number(m.pointsB) };
    const win = cfg.win ?? 10, lose = cfg.lose ?? 0, w = sid(m.winner);
    return { a: sid(m.memberA) === w ? win : lose, b: sid(m.memberB) === w ? win : lose };
  }

  // Circle-method pairings. Returns [{round, a, b}]
  function rrSchedule(ids, cycles = 1) {
    const p = ids.map(sid); if (p.length % 2) p.push(null);
    const n = p.length, rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const m = [];
      for (let i = 0; i < n / 2; i++) { const a = p[i], b = p[n - 1 - i]; if (a != null && b != null) m.push([a, b]); }
      rounds.push(m);
      p.splice(1, 0, p.pop());
    }
    const out = [];
    for (let c = 0; c < cycles; c++)
      rounds.forEach((m, r) => m.forEach(([a, b]) => out.push({ round: c * rounds.length + r + 1, a: c % 2 ? b : a, b: c % 2 ? a : b })));
    return out;
  }

  // Standings. Ties on points: head-to-head (TB sail-off > completed > forfeit), recursive on sub-groups,
  // then coordinator override (overrides[id] = 1..n). Anything still level is reported in `unresolved`.
  function roundRobinTable(matches, cfg = {}, ids = [], overrides = {}) {
    const R = {}, get = i => R[sid(i)] || (R[sid(i)] = { id: sid(i), played: 0, wins: 0, points: 0 });
    ids.forEach(get);
    matches.filter(m => norm(m.stage) === "RR" && isDone(m)).forEach(m => {
      const p = matchPoints(m, cfg), A = get(m.memberA), B = get(m.memberB);
      A.played++; B.played++; A.points += p.a; B.points += p.b;
      (sid(m.winner) === sid(m.memberA) ? A : B).wins++;
    });
    const key = (a, b) => [sid(a), sid(b)].sort().join("|");
    const pri = m => norm(m.stage) === "TB" ? 3 : norm(m.status) === "COMPLETED" ? 2 : 1;
    const meet = {};
    matches.filter(m => ["RR", "TB"].includes(norm(m.stage)) && isDone(m)).forEach(m => {
      const k = key(m.memberA, m.memberB); if (!meet[k] || pri(m) >= pri(meet[k])) meet[k] = m;
    });
    const unresolved = [];
    const split = g => {
      if (g.length < 2) return g;
      const w = {}; g.forEach(i => w[i] = 0);
      for (let x = 0; x < g.length; x++) for (let y = x + 1; y < g.length; y++) { const m = meet[key(g[x], g[y])]; if (m) w[sid(m.winner)]++; }
      const buckets = [...new Set(Object.values(w))].sort((a, b) => b - a).map(v => g.filter(i => w[i] === v));
      if (buckets.length === 1) {
        if (g.every(i => Number(overrides[i]) > 0)) return g.slice().sort((a, b) => overrides[a] - overrides[b]);
        unresolved.push(g); return g;
      }
      return buckets.flatMap(split);
    };
    const byPts = {}; Object.values(R).forEach(r => (byPts[r.points] = byPts[r.points] || []).push(r.id));
    const order = Object.keys(byPts).map(Number).sort((a, b) => b - a).flatMap(p => split(byPts[p]));
    const tied = new Set(unresolved.flat());
    return { rows: order.map((id, i) => ({ ...R[id], rank: i + 1, tied: tied.has(id) })), unresolved };
  }

  const bracketSize = n => { let s = 2; while (s < n) s *= 2; return s; };
  const stageNames = size => STAGES.slice(-Math.log2(size));
  const seedOrder = size => { let o = [1]; while (o.length < size) { const n = o.length * 2; o = o.flatMap(s => [s, n + 1 - s]); } return o; };

  // seeds = member ids ordered by rank. Top seeds get byes when seeds.length isn't a power of 2.
  function knockoutFirstRound(seeds) {
    const size = bracketSize(seeds.length), ord = seedOrder(size), stage = stageNames(size)[0], out = [];
    for (let i = 0; i < size; i += 2) {
      const a = seeds[ord[i] - 1], b = seeds[ord[i + 1] - 1], bye = a == null || b == null;
      out.push({ stage, round: 1, matchNo: i / 2 + 1, memberA: a ?? "", memberB: b ?? "",
                 winner: bye ? sid(a ?? b) : "", status: bye ? "bye" : "scheduled" });
    }
    return out;
  }

  // Winners of match 2k-1 and 2k meet in match k of the next stage; null until the stage is complete.
  function knockoutNext(stageMatches, nextStage) {
    const s = stageMatches.slice().sort((x, y) => Number(x.matchNo) - Number(y.matchNo));
    if (!s.length || s.some(m => !sid(m.winner))) return null;
    const out = [];
    for (let i = 0; i < s.length; i += 2)
      out.push({ stage: nextStage, round: 1, matchNo: i / 2 + 1, memberA: sid(s[i].winner), memberB: sid(s[i + 1].winner), winner: "", status: "scheduled" });
    return out;
  }

  function seriesTotals(matches, rrCfg = {}, koCfg = {}) {
    const t = {};
    matches.forEach(m => {
      const p = matchPoints(m, norm(m.stage) === "RR" ? rrCfg : koCfg);
      if (sid(m.memberA)) t[sid(m.memberA)] = (t[sid(m.memberA)] || 0) + p.a;
      if (sid(m.memberB)) t[sid(m.memberB)] = (t[sid(m.memberB)] || 0) + p.b;
    });
    return t;
  }

  function champion(matches) {
    const f = matches.find(m => norm(m.stage) === "F" && sid(m.winner)); if (!f) return null;
    return { winner: sid(f.winner), runnerUp: sid(f.winner) === sid(f.memberA) ? sid(f.memberB) : sid(f.memberA) };
  }

  return { competitors, points, STAGES, cfgOf, matchPoints, rrSchedule, roundRobinTable, bracketSize, stageNames, knockoutFirstRound, knockoutNext, seriesTotals, champion };
})();