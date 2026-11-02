# :rocket: Pull Request

## :clipboard: Description

### What does this PR do?

Adds optional Redis Sentinel support to device-registry, controlled by a new `REDIS_USE_SENTINEL` flag. The flag is off by default, so the service keeps using its current standalone Redis connection until cutover.

With the flag on, the service:

- Finds the current Redis master through Sentinel and follows it after a failover, with no restart or config change.
- Stops waiting on Redis after 3 seconds and pauses Redis calls for 5 seconds, so requests use the existing fallback cache instead of hanging.
- Cancels timed-out commands that haven't been sent yet, so they can't run later when a master returns. A command that was already sent may still have applied, so the timeout error reports its outcome as unknown.
- Keeps the Redis node password and the Sentinel password separate, and never sends the node password to Sentinel.
- Keeps retrying if Sentinel is unavailable at startup, using the fallback cache until it connects.

This PR also:

- Adds a `mode` field (`standalone` or `sentinel`) to the Redis status in the health endpoint response.
- Adds the new variables to the env templates and README.
- Removes the unused `MONGO_DB_ADMIN_VM_USERNAME` and `MONGO_DB_ADMIN_VM_PASSWORD` keys from the env templates.

### Why is this change needed?

TechOps is moving Redis from a standalone master-replica setup to Sentinel so that failovers happen automatically. Each service must support Sentinel in code before the infrastructure cutover, because changing only the host and port won't work.

The Sentinel client alone also wasn't enough for this service. In local testing, it kept reporting itself as ready during a total Redis outage, and commands never finished. Requests would have hung instead of using the fallback cache, so this PR adds fail-fast handling.

---

## :link: Related Issues

- [ ] Closes #
- [ ] Fixes #
- [ ] Related to #

---

## :arrows_counterclockwise: Type of Change

- [ ] :bug: Bug fix
- [x] :sparkles: New feature
- [ ] :wrench: Enhancement/improvement
- [x] :books: Documentation update
- [ ] :recycle: Refactor
- [x] :wastebasket: Removal/deprecation

---

## :building_construction: Affected Services

**Microservices changed:** device-registry

---

## :test_tube: Testing

- [x] Unit tests added/updated
- [x] Manual testing completed
- [ ] All existing tests pass

**Test summary:**

- **Unit tests:** added 17 tests covering mode selection, command arguments, timeouts, cancellation, recovery, connection retries, password handling and error handling. The 9 Redis-related test files pass (109 tests, 0 failures).
- **Full suite:** it did not complete locally because an unrelated job test stops the run while loading when no database connection is available. It should be confirmed in CI.
- **Manual testing:** ran the service's Redis module against a local cluster of 1 master, 1 replica and 3 Sentinels. This has not yet been tested against the staging Sentinel.

| Scenario | Result |
|---|---|
| Master killed | Worst wait about 3s, nothing left hanging, writes reached the new master |
| Write timed out during failover | Cancelled, and the key was not on the new master afterwards |
| Total outage | Worst wait about 3s, nothing left hanging, reads served from the fallback cache |
| Cluster restarted | Recovered within about 2s |
| Sentinel down at startup | Used the fallback cache, then connected once Sentinel was up |
| Password on Redis nodes only, with a database number set | Commands and shutdown worked |
| Separate and matching passwords on nodes and Sentinel | Commands and shutdown worked |
| Flag off or unset | Connected in standalone mode |

---

## :boom: Breaking Changes

- [x] **No breaking changes**
- [ ] **Has breaking changes** (describe below)

The flag defaults to off, so this can be deployed before the Redis infrastructure changes. The new health response field is additive.

---

## :memo: Additional Notes

**New environment variables** (all ignored while the flag is off):

| Variable | Purpose |
|---|---|
| `REDIS_USE_SENTINEL` | Turns on Sentinel mode. Defaults to off |
| `REDIS_HOST` | Sentinel host. Falls back to `REDIS_SERVER` if unset |
| `REDIS_SENTINEL_MASTER` | Sentinel master name. Defaults to `mymaster` |
| `REDIS_PASSWORD` | Redis node password in Sentinel mode |
| `REDIS_SENTINEL_PASSWORD` | Sentinel password. Must be set if Sentinel requires one, even if it matches `REDIS_PASSWORD` |
| `REDIS_DB` | Redis database number |

**Cutover steps** (after TechOps confirms the Sentinel infrastructure is healthy):

1. Set `REDIS_USE_SENTINEL=true` and `REDIS_PORT=26379` together, as changing only one breaks the Redis connection.
2. Restart the service.
3. Confirm that `GET /api/v2/devices/health` shows `mode: sentinel` and `ready: true`.

To roll back, restore both values and restart.

**Open items:**

- TechOps still needs to confirm whether the password applies to Sentinel, the Redis nodes or both, so that the matching variables are set at cutover. If Sentinel requires a password and `REDIS_SENTINEL_PASSWORD` isn't set, the service can't connect and stays on the fallback cache.
- TechOps still needs to confirm the production Sentinel host and master name.

**Known limitations in Sentinel mode:**

- Any Redis command the service starts using in future must be added to the Sentinel client's supported list. The same applies to any new `SET` option beyond `NX` and `EX`.
- The Redis library prints `None of the sentinels are available` to the console during an outage, and this PR does not silence it.

---

## :white_check_mark: Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [x] Documentation updated (if needed)
- [ ] Ready for review

🤖 Generated with [Claude Code](https://claude.com/claude-code)
