export const defaultWeights = {
  efficacy: 0.45,
  safety: 0.35,
  complexityBalance: 0.2,
};

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function normalizeWeights(input = {}) {
  const merged = {
    efficacy: Number(input.efficacy ?? defaultWeights.efficacy),
    safety: Number(input.safety ?? defaultWeights.safety),
    complexityBalance: Number(input.complexityBalance ?? defaultWeights.complexityBalance),
  };

  const total = merged.efficacy + merged.safety + merged.complexityBalance;
  if (!Number.isFinite(total) || total <= 0) {
    return { ...defaultWeights };
  }

  return {
    efficacy: merged.efficacy / total,
    safety: merged.safety / total,
    complexityBalance: merged.complexityBalance / total,
  };
}

export function computeWeightedScore(candidate, weights = defaultWeights) {
  const efficacy = clamp01(candidate.efficacy_index);
  const safety = clamp01(candidate.safety_index);
  const complexity = clamp01(candidate.molecular_complexity);

  const complexityBalance = clamp01(1 - Math.abs(complexity - 0.5) * 2);

  const score =
    efficacy * weights.efficacy +
    safety * weights.safety +
    complexityBalance * weights.complexityBalance;

  return Number(score.toFixed(6));
}

export function rankCandidates(candidates, weights = defaultWeights) {
  const ranked = candidates
    .map((c) => ({
      ...c,
      api_score: computeWeightedScore(c, weights),
    }))
    .sort((a, b) => b.api_score - a.api_score)
    .map((c, index) => ({ ...c, api_rank: index + 1 }));

  return ranked;
}
