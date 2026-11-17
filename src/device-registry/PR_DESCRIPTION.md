# :rocket: Pull Request

## :clipboard: Description

### What does this PR do?

Follow-up maintenance cleanup for device-registry:

- Removes 23 npm dependencies that the service never loads. The lockfile drops 477 packages and about 5,000 lines.
- Removes two commented-out lines from the server startup: a disabled signals job and a v1 route mount that is no longer used.

Removed dependencies: `@kafkajs/confluent-schema-registry`, `avsc`, `connect-mongo`, `express-cluster`, `express-session`, `express-validation`, `install`, `jade`, `jsonwebtoken`, `kafka-node`, `moesif-nodejs`, `mongodb`, `mqtt`, `ngeohash`, `node-fetch`, `npm`, `passport`, `passport-jwt`, `point-in-polygon`, `retry-request`, `serve-favicon`, `underscore`, `unique-names-generator`.

### Why is this change needed?

- **Smaller install and image:** production builds install 477 fewer packages, so builds are faster and the image is lighter.
- **Smaller security surface:** fewer packages means fewer security alerts and fewer upgrades to chase for code we never run.
- **Clearer startup code:** removing the disabled lines makes it obvious what actually runs at startup.

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
- [x] :wastebasket: Removal/deprecation

---

## :building_construction: Affected Services

**Microservices changed:** device-registry

---

## :test_tube: Testing

- [ ] Unit tests added/updated
- [x] Manual testing completed
- [ ] All existing tests pass

**Test summary:**

- **Nothing loads the removed packages:** each was searched for across all source, config, script and deployment files.
- **Other packages unchanged:** in the lockfile, every package that stays keeps the same version, and none were added.
- **Production install checked:** a clean production-only install (`npm ci --omit=dev`, the same step the production Docker stage runs) was done in a scratch folder. Every external package the service loads resolves.
- **Database library unaffected:** removing the top-level `mongodb` package is safe because `mongoose` ships its own copy of the MongoDB driver.
- **Routes load:** all v2 route modules load successfully.
- **Unit tests:** every unit test file was run separately, before and after the change, with identical results: 1,320 passing and 43 failing. The 43 failures already exist on `staging` and are not caused by this PR.

---

## :boom: Breaking Changes

- [x] **No breaking changes**
- [ ] **Has breaking changes** (describe below)

No endpoint, response shape, status code, scheduled job or runtime dependency changes.

---

## :memo: Additional Notes

- **Existing issue found:** one unscheduled device-status job loads `mathjs`, which was never installed (it is missing from the lockfile on `staging` too). It doesn't affect anything today because the job never runs. It will be handled with the pending team decision on whether to enable or retire the unscheduled uptime jobs.
- **Please confirm the CI Docker build succeeds before merging.** It could not be run locally.

---

## :white_check_mark: Checklist

- [x] Code follows project style guidelines
- [x] Self-review completed
- [ ] Documentation updated (if needed)
- [ ] Ready for review
