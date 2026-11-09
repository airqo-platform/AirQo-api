// Query parameters that carry credentials. They must never be echoed back in
// response links (meta.nextPage / meta.previousPage), which clients log,
// cache and share. Matched case-insensitively (e.g. `token` and `TOKEN`).
const CREDENTIAL_QUERY_PARAMS = new Set([
  "token",
  "access_token",
  "api_key",
  "apikey",
  "key",
]);

/**
 * Builds the query object for a pagination link: the request's query params
 * minus any credential params, with the given overrides (e.g. skip/limit).
 *
 * @param {Object} [query={}] - The incoming request.query.
 * @param {Object} [overrides={}] - Params to set on the link, e.g. { skip, limit }.
 * @returns {Object} A new query object safe to put in a response URL.
 */
const buildPaginationQuery = (query = {}, overrides = {}) => {
  const safeQuery = {};
  Object.keys(query || {}).forEach((param) => {
    if (!CREDENTIAL_QUERY_PARAMS.has(param.toLowerCase())) {
      safeQuery[param] = query[param];
    }
  });
  return { ...safeQuery, ...overrides };
};

module.exports = { buildPaginationQuery, CREDENTIAL_QUERY_PARAMS };
