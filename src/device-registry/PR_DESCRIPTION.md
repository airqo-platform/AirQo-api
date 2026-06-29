# :rocket: Pull Request

## :clipboard: Description

### What does this PR do?
Moves five process-management scripts (`cleanup-all.js`, `diagnose-jobs.js`, `emergency-job-killer.js`, `kill-app.js`, `kill-jobs.js`) from the root of `device-registry` into the existing `scripts/` directory. Also moves the orphaned Kafka topic configuration `state.yaml` into `config/` alongside the other Kafka-related config files. Updates all affected `npm run` script entries in `package.json` to reflect the new paths.

### Why is this change needed?
The files were misplaced at the microservice root with no clear grouping. The `scripts/` directory was already registered as a module alias (`"@scripts": "scripts"`) in `package.json` but did not exist. Likewise, `state.yaml` is Kafka topic configuration and belongs next to `check-kafka-status.js` and `cleanup-kafka.js` in `config/`. This change makes the directory structure self-explanatory without altering any runtime behaviour.

---

## :link: Related Issues

- [ ] Closes #
- [ ] Fixes #
- [ ] Related to #

---

## :arrows_counterclockwise: Type of Change

- [ ] :bug: Bug fix
- [ ] :sparkles: New feature
- [ ] :wrench: Enhancement/improvement
- [ ] :books: Documentation update
- [x] :recycle: Refactor
- [ ] :wastebasket: Removal/deprecation

---

## :building_construction: Affected Services

**Microservices changed:**
- `device-registry`

---

## :test_tube: Testing

- [ ] Unit tests added/updated
- [x] Manual testing completed
- [x] All existing tests pass

**Test summary:**
No logic was changed — only file locations and the corresponding `package.json` script paths. All `npm run kill`, `npm run cleanup`, `npm run emergency`, `npm run cleanup:all`, and `npm run diagnose-jobs` commands were verified to resolve correctly after the move.

---

## :boom: Breaking Changes

- [x] **No breaking changes**
- [ ] **Has breaking changes** (describe below)

---

## :memo: Additional Notes

- The `scripts/` directory now physically exists, fulfilling the pre-existing `_moduleAliases` entry `"@scripts": "scripts"` in `package.json`.
- The string values of `cleanupScriptName`, `diagnoseScriptName`, and `emergencyScriptName` in `config/service-detector.js` are display-only metadata and were intentionally left unchanged.
- `state.yaml` had no code references — it was an orphaned file at the root.

---

## :white_check_mark: Checklist

- [x] Code follows project style guidelines
- [x] Self-review completed
- [ ] Documentation updated (if needed)
- [x] Ready for review
