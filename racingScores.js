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

  return { competitors, points };
})();