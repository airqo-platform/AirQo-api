const fs = require("fs");
const path = require("path");
const chai = require("chai");
const { expect } = chai;
const sinon = require("sinon");
const proxyquireLib = require("proxyquire");
const supertest = require("supertest");
const express = require("express");

// `.noCallThru()` is required here, not optional. Without it, proxyquire's
// default "call thru" behavior fills in any keys missing from a stub by
// actually `Module._load`-ing the real module behind the scenes (see
// node_modules/proxyquire/lib/proxyquire.js, the `fillMissingKeys(...)`
// call inside `_require`). For every one of the ~36 real "@routes/v2/*"
// route files, that real load transitively pulls in "@config/constants",
// which bootstraps a live Redis connection + Kafka producer with no local
// broker available -- hanging the process indefinitely. `.noCallThru()`
// skips that fill-in entirely, so our stub is used as-is and the real
// route files are never touched.
//
// `require("proxyquire")` is deliberately NOT module-cached (see
// node_modules/proxyquire/index.js: it deletes itself from require.cache
// right after first load), so this instance -- and any flags set on it --
// is private to this test file and can't leak into other test files' use
// of proxyquire.
const proxyquire = proxyquireLib.noCallThru();

const INDEX_MODULE_REQUEST = "../index";
const INDEX_SOURCE_PATH = path.join(__dirname, "..", "index.js");

// ---------------------------------------------------------------------------
// Read the real authRoutes array out of routes/v2/index.js at test-run time,
// rather than hand-copying/guessing the list of ~36 route entries here. This
// is both the source of truth for "how many routes should there be" and the
// literal set of module-alias strings we need to supply proxyquire stubs
// for (proxyquire matches stub keys against the exact string passed to the
// SUT's `require(...)` call, so these have to be copied verbatim, not
// retyped from memory).
// ---------------------------------------------------------------------------
function parseAuthRoutesFromSource() {
  const src = fs.readFileSync(INDEX_SOURCE_PATH, "utf8");

  const start = src.indexOf("const authRoutes = [");
  const end = start === -1 ? -1 : src.indexOf("\n];", start);

  if (start === -1 || end === -1) {
    throw new Error(
      "ut_index.js: could not locate the `const authRoutes = [ ... ];` " +
        "block in routes/v2/index.js -- the source shape has changed and " +
        "this test's parser needs updating."
    );
  }

  const block = src.slice(start, end);

  const entryPattern = /\{\s*path:\s*"([^"]+)",\s*route:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*description:\s*"([^"]*)",?\s*\}/g;
  const entries = [];
  let match;
  while ((match = entryPattern.exec(block)) !== null) {
    entries.push({ path: match[1], route: match[2], name: match[3] });
  }

  // Sanity cross-check against a much simpler pattern, in case a future edit
  // (e.g. a multi-line description) makes the object-shaped regex above
  // silently under-match. Fail loudly rather than testing against a
  // silently-truncated list.
  const looseRouteCount = (block.match(/route:\s*"@routes\/v2\/[^"]+"/g) || [])
    .length;
  if (entries.length === 0 || entries.length !== looseRouteCount) {
    throw new Error(
      `ut_index.js: parsed ${entries.length} authRoutes entries but found ` +
        `${looseRouteCount} "route:" fields -- the parser in this test is ` +
        "out of sync with routes/v2/index.js's source formatting."
    );
  }

  return entries;
}

const AUTH_ROUTES = parseAuthRoutesFromSource();

// ---------------------------------------------------------------------------
// Stub builders
// ---------------------------------------------------------------------------

function makeGenericStubRouter(name) {
  const r = express.Router();
  r.get("/", (req, res) => res.status(200).json({ stub: name }));
  return r;
}

// The real users.routes module mounts at "/" and (like most "core resource"
// routers) almost certainly registers a param route such as GET /:user_id.
// routes/v2/index.js explicitly sorts "/" to load *last* specifically so a
// route like that can't shadow everything else mounted before it. A bare
// `GET "/"` stub wouldn't be able to detect a mounting-order regression --
// a wrongly-early "/" mount would have no route matching e.g. "/networks"
// and Express would simply fall through to the real networks router
// regardless of order. Giving the stub a param route makes a
// mounting-order bug observable: if "/" were mounted before "/networks",
// requests to "/networks" would incorrectly get swallowed by this handler.
function makeUsersStubRouter() {
  const r = express.Router();
  r.get("/", (req, res) => res.status(200).json({ stub: "users" }));
  r.get("/:id", (req, res) =>
    res.status(200).json({ stub: "users", id: req.params.id })
  );
  return r;
}

function buildAllPassingStubs() {
  const stubs = {};
  AUTH_ROUTES.forEach(({ route, name }) => {
    stubs[route] = name === "users" ? makeUsersStubRouter() : makeGenericStubRouter(name);
  });
  return stubs;
}

// Every call gets its own fresh execution of routes/v2/index.js. Proxyquire
// always deletes the SUT from Node's require cache before loading it (see
// `_disableModuleCache` in proxyquire's source) regardless of
// preserveCache settings, so each call here re-runs index.js's top-level
// code from scratch -- a brand new `moduleCache` Map and a brand new
// `routeStatus` object inside index.js's closure every time. That's
// exactly what we want: each describe block below uses a different stub
// arrangement (all-passing vs. one-broken), and none of them can leak
// loaded-route bookkeeping into each other.
function loadIndexRouter(stubs) {
  return proxyquire(INDEX_MODULE_REQUEST, stubs);
}

function buildApp(indexRouter) {
  const app = express();
  app.use("/", indexRouter);
  return app;
}

// index.js logs every route load/failure via console.info/warn/error
// (logInfo/logWarning/logError). That's expected and harmless noise for the
// failure-path describes below, which deliberately trigger it; silence it
// so a real `npm test` run isn't misleading.
function silenceRouteLoaderLogs() {
  sinon.stub(console, "info");
  sinon.stub(console, "warn");
  sinon.stub(console, "error");
}

describe("routes/v2/index.js -- auth route aggregator", () => {
  describe("all routes load successfully", () => {
    let app;
    let request;
    let indexRouter;

    before(() => {
      silenceRouteLoaderLogs();
      indexRouter = loadIndexRouter(buildAllPassingStubs());
      app = buildApp(indexRouter);
      request = supertest(app);
    });

    after(() => {
      sinon.restore();
    });

    it("GET /health reports healthy with zero failures", async () => {
      const res = await request.get("/health").expect(200);

      expect(res.body.service).to.equal("auth-service");
      expect(res.body.status).to.equal("healthy");
      expect(res.body.routes.total).to.equal(AUTH_ROUTES.length);
      expect(res.body.routes.loaded).to.equal(AUTH_ROUTES.length);
      expect(res.body.routes.failed).to.equal(0);
      expect(res.body.routes.successRate).to.equal("100%");
      expect(res.body.loadedRoutes).to.have.lengthOf(AUTH_ROUTES.length);
      expect(res.body).to.not.have.property("failedRoutes");
      expect(res.body).to.not.have.property("criticalAlert");
      expect(res.body.mountPoint).to.equal("/api/v2");
    });

    it("GET /routes reports every route as loaded", async () => {
      const res = await request.get("/routes").expect(200);

      expect(res.body.mountPoint).to.equal("/api/v2");
      expect(res.body.routes).to.have.lengthOf(AUTH_ROUTES.length);
      res.body.routes.forEach((r) => {
        expect(r.status).to.equal("loaded");
      });
    });

    it("GET /routes computes fullEndpoint correctly, including the root '/' route", async () => {
      const res = await request.get("/routes").expect(200);
      const byName = Object.fromEntries(res.body.routes.map((r) => [r.name, r]));

      expect(byName.users.fullEndpoint).to.equal("/api/v2");
      expect(byName.networks.fullEndpoint).to.equal("/api/v2/networks");
    });

    it("categorizes known route names per getCategoryForRoute's category map", async () => {
      const res = await request.get("/routes").expect(200);
      const categoryByName = Object.fromEntries(
        res.body.routes.map((r) => [r.name, r.category])
      );

      expect(categoryByName.users).to.equal("core");
      expect(categoryByName.clients).to.equal("oauth");
      // "tokens" appears in both the "core" and "oauth" buckets in the real
      // category map; getCategoryForRoute iterates categories in object
      // definition order and returns on first match, and "core" is defined
      // before "oauth", so "tokens" resolves to "core" (the "oauth" listing
      // of it is unreachable).
      expect(categoryByName.tokens).to.equal("core");
      expect(categoryByName["scope-rules"]).to.equal("uncategorized");
    });

    it("actually dispatches a real request through a mounted sub-router (/networks)", async () => {
      const res = await request.get("/networks").expect(200);
      expect(res.body).to.deep.equal({ stub: "networks" });
    });

    it("mounts the users ('/') catch-all last, so it doesn't shadow other routes", async () => {
      // If "/" had been mounted before "/networks", this request would be
      // swallowed by the users stub's GET "/:id" handler (id="networks")
      // instead of ever reaching the networks router.
      const res = await request.get("/networks").expect(200);
      expect(res.body).to.deep.equal({ stub: "networks" });
    });

    it("still serves the users route itself, both root and catch-all", async () => {
      const rootRes = await request.get("/").expect(200);
      expect(rootRes.body).to.deep.equal({ stub: "users" });

      // A path with no earlier, more specific mount correctly falls through
      // to the users catch-all -- proving it's reachable, just last in line.
      const idRes = await request.get("/some-unmounted-path").expect(200);
      expect(idRes.body).to.deep.equal({
        stub: "users",
        id: "some-unmounted-path",
      });
    });

    it("exposes router.getRouteStatus() reflecting a fully healthy load", () => {
      expect(indexRouter.getRouteStatus()).to.deep.equal({
        total: AUTH_ROUTES.length,
        loaded: AUTH_ROUTES.length,
        failed: 0,
        status: "healthy",
      });
    });
  });

  // -------------------------------------------------------------------------
  // Partial failure #1: the route module throws while being required (e.g.
  // it doesn't export a function/object). This is caught *inside*
  // `safeRequireRoute`, which -- notably -- never rethrows: it always
  // returns a valid fallback Express router (the 503 "errorRouter").
  // Because of that, `safeMountRoute`'s `router.use(mountPath, routeModule)`
  // call always succeeds (a Router is always valid middleware), so
  // `safeMountRoute` returns `true` and the route is recorded in
  // `routeStatus.loaded`, never `routeStatus.failed`. This is verified
  // behavior (traced by hand and confirmed with a standalone script against
  // the real source), not a guess: a require-time failure is served
  // correctly (503, for any method, with the documented error shape) but is
  // *not* reflected in /health or /routes, which both report it as
  // "loaded"/healthy regardless. This describe block documents that actual
  // (surprising) behavior rather than the naively-expected one.
  // -------------------------------------------------------------------------
  describe("one route throws while loading (require-time failure)", () => {
    const FAILING_NAME = "scopes";
    let app;
    let request;
    let failingEntry;

    before(() => {
      failingEntry = AUTH_ROUTES.find((r) => r.name === FAILING_NAME);
      if (!failingEntry) {
        throw new Error(
          `Expected an authRoutes entry named "${FAILING_NAME}" to use for ` +
            "this test -- routes/v2/index.js's route list may have changed."
        );
      }

      silenceRouteLoaderLogs();
      const stubs = buildAllPassingStubs();
      // Not a router or a plausible module export at all: safeRequireRoute's
      // own validation (`typeof routeModule !== "function" && typeof
      // routeModule !== "object"`) rejects a string, throws internally, and
      // is caught -- producing the 503 fallback router.
      stubs[failingEntry.route] = "not-a-router";

      const indexRouter = loadIndexRouter(stubs);
      app = buildApp(indexRouter);
      request = supertest(app);
    });

    after(() => {
      sinon.restore();
    });

    it("GET /health still reports healthy (routeStatus.failed is never populated in this path)", async () => {
      const res = await request.get("/health").expect(200);

      expect(res.body.status).to.equal("healthy");
      expect(res.body.routes.total).to.equal(AUTH_ROUTES.length);
      expect(res.body.routes.loaded).to.equal(AUTH_ROUTES.length);
      expect(res.body.routes.failed).to.equal(0);
      expect(res.body).to.not.have.property("failedRoutes");
    });

    it("GET /routes still shows the broken route as 'loaded'", async () => {
      const res = await request.get("/routes").expect(200);
      const entry = res.body.routes.find((r) => r.name === FAILING_NAME);
      expect(entry.status).to.equal("loaded");
    });

    it("but the route itself correctly serves the documented 503 fallback shape", async () => {
      // req.path inside the fallback errorRouter is relative to its own
      // mount point: a bare request to the mount path itself lands on "/".
      const res = await request.get(failingEntry.path).expect(503);

      expect(res.body.error).to.equal(
        "Auth service route temporarily unavailable"
      );
      expect(res.body.message).to.include(FAILING_NAME);
      expect(res.body.service).to.equal("auth-service");
      expect(res.body.path).to.equal("/");
      expect(res.body.method).to.equal("GET");
      expect(res.body).to.have.property("timestamp");
      expect(res.body).to.have.property("suggestion");
    });

    it("preserves the request's sub-path within the fallback router", async () => {
      const res = await request.get(`${failingEntry.path}/sub-path`).expect(503);
      expect(res.body.path).to.equal("/sub-path");
    });

    it("falls back for any HTTP method, not just GET (errorRouter.all('*', ...))", async () => {
      const res = await request.post(failingEntry.path).expect(503);
      expect(res.body.method).to.equal("POST");
      expect(res.body.error).to.equal(
        "Auth service route temporarily unavailable"
      );
    });

    it("includes routePath only when NODE_ENV is 'development'", async () => {
      const originalNodeEnv = process.env.NODE_ENV;

      try {
        process.env.NODE_ENV = "development";
        const devRes = await request.get(failingEntry.path).expect(503);
        expect(devRes.body.routePath).to.equal(failingEntry.route);

        process.env.NODE_ENV = "production";
        const prodRes = await request.get(failingEntry.path).expect(503);
        expect(prodRes.body).to.not.have.property("routePath");
      } finally {
        if (originalNodeEnv === undefined) {
          delete process.env.NODE_ENV;
        } else {
          process.env.NODE_ENV = originalNodeEnv;
        }
      }
    });

    it("does not affect other routes (e.g. /networks still works)", async () => {
      const res = await request.get("/networks").expect(200);
      expect(res.body).to.deep.equal({ stub: "networks" });
    });
  });

  // -------------------------------------------------------------------------
  // Partial failure #2: the route module *is* returned successfully from
  // `require` (so safeRequireRoute's loose `typeof === "object"` check
  // passes -- a plain object satisfies that check without being a valid
  // Express middleware), but `router.use(mountPath, routeModule)` itself
  // throws a real TypeError ("Router.use() requires a middleware function
  // but got a Object") because Express's own validation is stricter than
  // safeRequireRoute's. That throw happens inside safeMountRoute's own
  // try/catch, so *that* is what actually makes safeMountRoute return
  // false and populate routeStatus.failed -- confirmed against Express's
  // real Router.use() implementation, not assumed.
  //
  // The consequence: /health and /routes correctly report this route as
  // failed/degraded, but -- unlike the require-time failure above -- the
  // route was *never mounted at all* (Express validates before it
  // registers the layer), so requests to it don't get the 503 fallback
  // shape. They instead fall through to whatever mount matches next, which
  // in this router is always the users "/" catch-all mounted last.
  // -------------------------------------------------------------------------
  describe("one route fails to mount (module isn't valid middleware)", () => {
    const FAILING_NAME = "departments";
    let app;
    let request;
    let failingEntry;

    before(() => {
      failingEntry = AUTH_ROUTES.find((r) => r.name === FAILING_NAME);
      if (!failingEntry) {
        throw new Error(
          `Expected an authRoutes entry named "${FAILING_NAME}" to use for ` +
            "this test -- routes/v2/index.js's route list may have changed."
        );
      }

      silenceRouteLoaderLogs();
      const stubs = buildAllPassingStubs();
      // A plain object passes safeRequireRoute's `typeof === "object"`
      // check (so it is NOT wrapped in a 503 fallback router) but is not
      // itself a callable Express middleware, so router.use() rejects it.
      stubs[failingEntry.route] = {};

      const indexRouter = loadIndexRouter(stubs);
      app = buildApp(indexRouter);
      request = supertest(app);
    });

    after(() => {
      sinon.restore();
    });

    it("GET /health reports degraded with exactly one failure", async () => {
      const res = await request.get("/health").expect(200);

      const expectedSuccessRate = `${Math.round(
        ((AUTH_ROUTES.length - 1) / AUTH_ROUTES.length) * 100
      )}%`;

      expect(res.body.status).to.equal("degraded");
      expect(res.body.routes.total).to.equal(AUTH_ROUTES.length);
      expect(res.body.routes.loaded).to.equal(AUTH_ROUTES.length - 1);
      expect(res.body.routes.failed).to.equal(1);
      expect(res.body.routes.successRate).to.equal(expectedSuccessRate);
      expect(res.body.failedRoutes).to.have.lengthOf(1);
      expect(res.body.failedRoutes[0].name).to.equal(FAILING_NAME);
      // Only 1 of 36 routes failed -- nowhere near the >50% threshold.
      expect(res.body.criticalAlert).to.equal(null);
    });

    it("GET /routes marks only the broken route as 'failed', everyone else 'loaded'", async () => {
      const res = await request.get("/routes").expect(200);
      const byName = Object.fromEntries(
        res.body.routes.map((r) => [r.name, r.status])
      );

      AUTH_ROUTES.forEach(({ name }) => {
        expect(byName[name]).to.equal(
          name === FAILING_NAME ? "failed" : "loaded"
        );
      });
    });

    it("was never actually mounted, so requests fall through to the users catch-all instead of a 503", async () => {
      const res = await request.get(failingEntry.path).expect(200);
      expect(res.body).to.deep.equal({
        stub: "users",
        id: failingEntry.name,
      });
    });

    it("exposes router.getRouteStatus() reflecting the degraded load", async () => {
      // Re-derive from a fresh load with identical stubs, since
      // getRouteStatus is a plain property on the router object (not an
      // HTTP route) and this describe's `app` doesn't expose its router.
      silenceRouteLoaderLogs();
      const stubs = buildAllPassingStubs();
      stubs[failingEntry.route] = {};
      const freshRouter = loadIndexRouter(stubs);

      expect(freshRouter.getRouteStatus()).to.deep.equal({
        total: AUTH_ROUTES.length,
        loaded: AUTH_ROUTES.length - 1,
        failed: 1,
        status: "degraded",
      });
    });

    it("does not affect other routes (e.g. /networks still works)", async () => {
      const res = await request.get("/networks").expect(200);
      expect(res.body).to.deep.equal({ stub: "networks" });
    });
  });
});
