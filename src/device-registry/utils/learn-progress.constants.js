// Single source of truth for Learn module scoring — shared by models/LearnProgress.js
// and utils/learn.util.js so the "level"/stage shown to a learner can never drift
// between the value persisted on their progress doc and the value used to build
// the catalog/leaderboard responses.

const POINTS_PER_QUESTION = 10;

// Fallback used only when the catalog has no gradable quiz activities yet
// (e.g. a fresh tenant) — see getMaxLearnPoints in utils/learn.util.js.
const DEFAULT_MAX_LEARN_POINTS = 2400;

const STAGES = [
  { index: 0, name: "Curious" },
  { index: 1, name: "Aware" },
  { index: 2, name: "Observer" },
  { index: 3, name: "Champion" },
  { index: 4, name: "Defender" },
];

function computeStage(totalPoints, maxPoints) {
  if (!maxPoints || maxPoints === 0) return STAGES[0];
  const ratio = totalPoints / maxPoints;
  if (ratio >= 1.0) return STAGES[4];
  if (ratio >= 0.75) return STAGES[3];
  if (ratio >= 0.5) return STAGES[2];
  if (ratio >= 0.25) return STAGES[1];
  return STAGES[0];
}

module.exports = {
  STAGES,
  computeStage,
  POINTS_PER_QUESTION,
  DEFAULT_MAX_LEARN_POINTS,
};
