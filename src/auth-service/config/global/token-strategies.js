// config/token-strategies.js
const TOKEN_STRATEGIES = {
  LEGACY: "legacy",
  STANDARD: "standard",
  ULTRA_COMPRESSED: "ultra_compressed",
  COMPRESSED: "compressed",
  HASH_BASED: "hash_based",
  ROLE_ONLY: "role_only",
  OPTIMIZED_HASH: "optimized_hash",
  BIT_FLAGS: "bit_flags",
  OPTIMIZED_BIT_FLAGS: "optimized_bit_flags",
  OPTIMIZED_ROLE_ONLY: "optimized_role_only",
  NO_ROLES_AND_PERMISSIONS: "no_roles_and_permissions",
};

module.exports = {
  TOKEN_STRATEGIES,
};
