// cohort-slug.util.js
// Self-service, user-chosen Cohort identifiers ("cohort_slug"). Additive to
// the existing ObjectId-based _id — see docs/COHORT_SELF_SERVICE_ID_AND_ACCESS_CONTROL_DESIGN.md.
const CohortModel = require("@models/Cohort");

const MIN_SLUG_LENGTH = 3;
const MAX_SLUG_LENGTH = 50;
const MAX_UNIQUE_ATTEMPTS = 20;

// Route segments/keywords under /cohorts that a slug must never collide
// with, plus a few generic words that would otherwise let one org squat on
// a name every other partner would also expect to use.
const RESERVED_COHORT_SLUGS = new Set([
  "admin",
  "api",
  "new",
  "null",
  "undefined",
  "true",
  "false",
  "promote",
  "networks",
  "network",
  "check-slug",
  "summary",
  "dashboard",
  "users",
  "sites",
  "devices",
  "cached-sites",
  "cached-devices",
  "from-cohorts",
  "verify",
  "filternonprivatedevices",
]);

function sanitizeSlugSegment(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildCandidateSlug({ requestedSlug, groupSlug } = {}) {
  const requestedPart = sanitizeSlugSegment(requestedSlug);
  // If the caller's requested part sanitizes away to nothing (e.g. "!!!"),
  // don't silently fall back to a bare group_slug — that would let a
  // garbage input claim a group-only identifier nobody actually asked for.
  if (!requestedPart) {
    return "";
  }
  const groupPart = sanitizeSlugSegment(groupSlug);
  const combined = groupPart ? `${groupPart}-${requestedPart}` : requestedPart;
  return combined.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, "");
}

async function slugExists(tenant, slug) {
  const existing = await CohortModel(tenant)
    .findOne({ cohort_slug: slug })
    .select("_id")
    .lean();
  return Boolean(existing);
}

function evaluateCandidate(candidate) {
  if (candidate.length < MIN_SLUG_LENGTH) {
    return {
      valid: false,
      reason: "too_short",
      message: `cohort_slug must be at least ${MIN_SLUG_LENGTH} characters after sanitization (got "${candidate}")`,
    };
  }
  if (RESERVED_COHORT_SLUGS.has(candidate)) {
    return {
      valid: false,
      reason: "reserved",
      message: `"${candidate}" is a reserved cohort_slug value, please choose another`,
    };
  }
  return { valid: true };
}

// Pre-checks + a short numeric-suffix retry loop for the common case
// (someone else already took the exact name). The model's sparse unique
// index on cohort_slug is the real correctness guarantee against a
// concurrent create racing this check — see CohortModel.register's
// duplicate-key handling — this loop just makes the happy path pleasant.
async function generateUniqueCohortSlug({
  tenant,
  requestedSlug,
  groupSlug,
} = {}) {
  const base = buildCandidateSlug({ requestedSlug, groupSlug });
  const baseCheck = evaluateCandidate(base);
  if (!baseCheck.valid) {
    return { success: false, message: baseCheck.message };
  }

  let candidate = base;
  for (let attempt = 1; attempt <= MAX_UNIQUE_ATTEMPTS; attempt++) {
    if (!(await slugExists(tenant, candidate))) {
      return { success: true, slug: candidate };
    }
    const suffix = `-${attempt}`;
    candidate = `${base.slice(0, MAX_SLUG_LENGTH - suffix.length)}${suffix}`;
  }

  return {
    success: false,
    message:
      "Unable to find an available cohort_slug close to what you requested, please try a different value",
  };
}

module.exports = {
  MIN_SLUG_LENGTH,
  MAX_SLUG_LENGTH,
  RESERVED_COHORT_SLUGS,
  sanitizeSlugSegment,
  buildCandidateSlug,
  evaluateCandidate,
  slugExists,
  generateUniqueCohortSlug,
};
