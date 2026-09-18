require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const rewire = require("rewire");
const mongoose = require("mongoose");
const constants = require("@config/constants");

const recorder = rewire("@utils/usage-recorder.util");

const makeUser = (email = "someone@example.com") => ({
  _id: new mongoose.Types.ObjectId(),
  email,
});

describe("usage-recorder.util", () => {
  let dailyBulkWrite;
  let profileBulkWrite;
  let original;

  beforeEach(() => {
    recorder._reset();
    dailyBulkWrite = sinon.stub().resolves({});
    profileBulkWrite = sinon.stub().resolves({});
    original = {
      daily: recorder.__get__("UserUsageDailyModel"),
      profile: recorder.__get__("UserUsageProfileModel"),
    };
    recorder.__set__("UserUsageDailyModel", () => ({ bulkWrite: dailyBulkWrite }));
    recorder.__set__("UserUsageProfileModel", () => ({ bulkWrite: profileBulkWrite }));
  });

  afterEach(() => {
    recorder.__set__("UserUsageDailyModel", original.daily);
    recorder.__set__("UserUsageProfileModel", original.profile);
    recorder._reset();
    sinon.restore();
  });

  describe("normalisePath", () => {
    it("drops query strings and hashes", () => {
      expect(recorder.normalisePath("/api/v2/devices?limit=5#x")).to.equal("/api/v2/devices");
    });

    it("replaces ids, uuids, numbers and emails with :id", () => {
      expect(
        recorder.normalisePath(
          "/api/v2/devices/5f8d0d55b54764421b7156c3/readings/123/a%40b.com",
        ),
      ).to.equal("/api/v2/devices/:id/readings/:id/:id");
      expect(
        recorder.normalisePath("/users/123e4567-e89b-12d3-a456-426614174000"),
      ).to.equal("/users/:id");
    });

    it("keeps Next.js dynamic segment templates as-is", () => {
      expect(recorder.normalisePath("/system/users/[id]")).to.equal("/system/users/[id]");
    });

    it("produces Mongo-safe keys (no dots or dollars)", () => {
      const key = recorder.normalisePath("/files/report.v1.csv$x");
      expect(key).to.not.match(/[.$]/);
    });

    it("caps depth and length, and rejects non-paths", () => {
      const deep = `/${Array.from({ length: 20 }, (_, i) => `s${i}`).join("/")}`;
      expect(recorder.normalisePath(deep).split("/").filter(Boolean)).to.have.length(8);
      expect(recorder.normalisePath(`/${"a".repeat(500)}`).length).to.be.at.most(120);
      expect(recorder.normalisePath("https://evil.example/x")).to.equal(null);
      expect(recorder.normalisePath(undefined)).to.equal(null);
    });
  });

  describe("recordApiCall", () => {
    it("counts a call and buckets it by hour", () => {
      const user = makeUser();
      const ok = recorder.recordApiCall({
        tenant: "airqo",
        user,
        uri: "/api/v2/devices/5f8d0d55b54764421b7156c3?x=1",
        method: "get",
      });
      expect(ok).to.equal(true);
      const [entry] = [...recorder._getBuffer().values()];
      expect(entry.api_calls).to.equal(1);
      expect(entry.api["GET /api/v2/devices/:id"]).to.equal(1);
      expect(Object.values(entry.api_hours)).to.deep.equal([1]);
    });

    it("ignores HEAD/OPTIONS, the beacon itself, and bad users", () => {
      const user = makeUser();
      expect(recorder.recordApiCall({ user, uri: "/a", method: "OPTIONS" })).to.equal(false);
      expect(recorder.recordApiCall({ user, uri: "/a", method: "HEAD" })).to.equal(false);
      expect(
        recorder.recordApiCall({ user, uri: "/api/v2/users/usage/events", method: "POST" }),
      ).to.equal(false);
      expect(
        recorder.recordApiCall({ user: { _id: "nope" }, uri: "/a", method: "GET" }),
      ).to.equal(false);
      expect(recorder._getBuffer().size).to.equal(0);
    });

    it("folds keys beyond the per-entry cap into (other)", () => {
      const cap = constants.USAGE_MAX_KEYS_PER_ENTRY;
      const user = makeUser();
      for (let i = 0; i < cap + 5; i += 1) {
        recorder.recordApiCall({ user, uri: `/svc/route${i}`, method: "GET" });
      }
      const [entry] = [...recorder._getBuffer().values()];
      expect(Object.keys(entry.api)).to.have.length(cap + 1);
      expect(entry.api["(other)"]).to.equal(5);
      expect(entry.api_calls).to.equal(cap + 5);
    });

    it("sheds new entries once the buffer is full, but keeps counting existing ones", () => {
      const prev = constants.USAGE_BUFFER_MAX_ENTRIES;
      constants.USAGE_BUFFER_MAX_ENTRIES = 2;
      try {
        const [a, b, c] = [makeUser(), makeUser(), makeUser()];
        expect(recorder.recordApiCall({ user: a, uri: "/x", method: "GET" })).to.equal(true);
        expect(recorder.recordApiCall({ user: b, uri: "/x", method: "GET" })).to.equal(true);
        expect(recorder.recordApiCall({ user: c, uri: "/x", method: "GET" })).to.equal(false);
        expect(recorder.recordApiCall({ user: a, uri: "/x", method: "GET" })).to.equal(true);
        expect(recorder.getStats().shed).to.equal(1);
      } finally {
        constants.USAGE_BUFFER_MAX_ENTRIES = prev;
      }
    });

    it("does nothing when tracking is disabled", () => {
      const prev = constants.USAGE_TRACKING_ENABLED;
      constants.USAGE_TRACKING_ENABLED = false;
      try {
        expect(recorder.recordApiCall({ user: makeUser(), uri: "/x", method: "GET" })).to.equal(false);
      } finally {
        constants.USAGE_TRACKING_ENABLED = prev;
      }
    });
  });

  describe("recordPageEvents", () => {
    it("counts views, clamps dwell time and counts session starts", () => {
      const user = makeUser();
      const accepted = recorder.recordPageEvents({
        user,
        events: [
          { type: "page_view", path: "/user/air-quality/analytics", duration_sec: 30, session_start: true },
          { path: "/user/air-quality/analytics", duration_sec: 999999 },
          { path: "not-a-path" },
          { type: "click", path: "/x" },
        ],
      });
      expect(accepted).to.equal(2);
      const [entry] = [...recorder._getBuffer().values()];
      expect(entry.page_views).to.equal(2);
      expect(entry.sessions).to.equal(1);
      expect(entry.pages["/user/air-quality/analytics"].n).to.equal(2);
      expect(entry.pages["/user/air-quality/analytics"].d).to.equal(30 + 4 * 60 * 60);
    });

    it("flags internal accounts by configured email domain", () => {
      const prev = constants.USAGE_INTERNAL_EMAIL_DOMAINS;
      constants.USAGE_INTERNAL_EMAIL_DOMAINS = ["staff.example"];
      try {
        expect(recorder.isInternalEmail("a@STAFF.example")).to.equal(true);
        expect(recorder.isInternalEmail("a@other.example")).to.equal(false);
        constants.USAGE_INTERNAL_EMAIL_DOMAINS = [];
        expect(recorder.isInternalEmail("a@staff.example")).to.equal(false);
      } finally {
        constants.USAGE_INTERNAL_EMAIL_DOMAINS = prev;
      }
    });
  });

  describe("flush", () => {
    it("writes one upsert per (user, day) with $inc counters, then empties the buffer", async () => {
      const user = makeUser();
      recorder.recordApiCall({ user, uri: "/api/v2/sites", method: "GET" });
      recorder.recordApiCall({ user, uri: "/api/v2/sites", method: "GET" });
      recorder.recordPageEvents({
        user,
        events: [{ path: "/user/home", duration_sec: 12, session_start: true }],
      });

      const result = await recorder.flush();
      expect(result.flushed).to.equal(1);
      expect(recorder._getBuffer().size).to.equal(0);

      const [dailyOps] = dailyBulkWrite.firstCall.args;
      expect(dailyOps).to.have.length(1);
      const { filter, update, upsert } = dailyOps[0].updateOne;
      expect(upsert).to.equal(true);
      expect(filter.day).to.match(/^\d{4}-\d{2}-\d{2}$/);
      expect(update.$inc).to.include({
        api_calls: 2,
        page_views: 1,
        sessions: 1,
        duration_sec: 12,
        "api.GET /api/v2/sites": 2,
        "pages./user/home.n": 1,
        "pages./user/home.d": 12,
      });
      expect(update.$setOnInsert.expireAt).to.be.instanceOf(Date);
      expect(dailyBulkWrite.firstCall.args[1]).to.deep.equal({ ordered: false });

      const [profileOps] = profileBulkWrite.firstCall.args;
      expect(profileOps[0].updateOne.update.$inc).to.deep.equal({
        total_page_views: 1,
        total_api_calls: 2,
      });
    });

    it("is a no-op when nothing is buffered", async () => {
      expect(await recorder.flush()).to.deep.equal({ flushed: 0 });
      expect(dailyBulkWrite.called).to.equal(false);
    });

    it("drops the batch instead of throwing when Mongo fails", async () => {
      dailyBulkWrite.rejects(new Error("mongo down"));
      recorder.recordApiCall({ user: makeUser(), uri: "/x", method: "GET" });
      await recorder.flush();
      expect(recorder.getStats().failed_entries).to.equal(1);
      expect(recorder._getBuffer().size).to.equal(0);
    });

    it("keeps events recorded during a flush for the next one", async () => {
      let release;
      dailyBulkWrite.callsFake(() => new Promise((resolve) => { release = resolve; }));
      recorder.recordApiCall({ user: makeUser(), uri: "/a", method: "GET" });
      const pending = recorder.flush();
      recorder.recordApiCall({ user: makeUser(), uri: "/b", method: "GET" });
      expect(recorder._getBuffer().size).to.equal(1);
      release({});
      await pending;
      dailyBulkWrite.resolves({});
      await recorder.flush();
      expect(recorder.getStats().flushed_entries).to.equal(2);
    });
  });
});
