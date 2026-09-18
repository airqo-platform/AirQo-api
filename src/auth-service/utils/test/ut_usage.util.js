require("module-alias/register");
const { expect } = require("chai");
const moment = require("moment-timezone");
const usage = require("@utils/usage.util");

describe("usage.util helpers", () => {
  describe("date helpers", () => {
    it("addDays / eachDate cross month and year boundaries", () => {
      expect(usage.addDays("2026-12-31", 1)).to.equal("2027-01-01");
      expect(usage.addDays("2026-03-01", -1)).to.equal("2026-02-28");
      expect(usage.eachDate("2026-02-27", "2026-03-02")).to.deep.equal([
        "2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02",
      ]);
    });

    it("monthBounds returns first/last day and the previous month", () => {
      expect(usage.monthBounds("2026-02")).to.deep.equal({
        month: "2026-02",
        start: "2026-02-01",
        end: "2026-02-28",
        previous: "2026-01",
      });
      expect(usage.monthBounds("2026-01").previous).to.equal("2025-12");
    });

    it("changePct handles a zero baseline", () => {
      expect(usage.changePct(150, 100)).to.equal(50);
      expect(usage.changePct(5, 0)).to.equal(null);
    });
  });

  describe("timezone bucketing", () => {
    const kampala = moment.tz.zone("Africa/Kampala");

    it("localParts shifts an instant into the viewer's day and hour", () => {
      // 22:00 UTC on the 18th is 01:00 on the 19th in Kampala (UTC+3).
      const ms = Date.parse("2026-09-18T22:00:00Z");
      expect(usage.localParts(ms, kampala)).to.include({
        date: "2026-09-19",
        hour: 1,
      });
    });

    it("localParts reports Monday as weekday 0", () => {
      // 2026-09-21 is a Monday.
      expect(usage.localParts(Date.parse("2026-09-21T09:00:00Z"), moment.tz.zone("UTC")).weekday).to.equal(0);
    });

    it("bucketByLocalDate moves late-UTC activity to the next local day", () => {
      const docs = [
        { day: "2026-09-18", page_hours: { 22: 4, 9: 1 }, api_hours: { 22: 6 } },
      ];
      const utc = usage.bucketByLocalDate(docs, moment.tz.zone("UTC"));
      expect(utc.get("2026-09-18")).to.deep.equal({ page_views: 5, api_calls: 6 });

      const local = usage.bucketByLocalDate(docs, kampala);
      expect(local.get("2026-09-18")).to.deep.equal({ page_views: 1, api_calls: 0 });
      expect(local.get("2026-09-19")).to.deep.equal({ page_views: 4, api_calls: 6 });
    });
  });

  describe("levels and streaks", () => {
    it("computeThresholds uses quartiles of non-zero days", () => {
      expect(usage.computeThresholds([0, 0, 1, 2, 3, 4, 5, 6, 7, 8])).to.deep.equal([2, 4, 6]);
      expect(usage.computeThresholds([0, 0])).to.deep.equal([0, 0, 0]);
    });

    it("levelFor maps counts onto 0-4", () => {
      const t = [2, 4, 6];
      expect([0, 1, 2, 3, 4, 5, 6, 7].map((c) => usage.levelFor(c, t))).to.deep.equal([
        0, 1, 1, 2, 2, 3, 3, 4,
      ]);
    });

    it("computeStreaks finds the longest run and a current run that may end yesterday", () => {
      const series = [1, 1, 0, 1, 1, 1, 0].map((count, i) => ({ date: `d${i}`, count }));
      // Last day (today) is empty, but the run ending yesterday still counts.
      expect(usage.computeStreaks(series)).to.deep.equal({ current: 3, longest: 3 });
      const broken = [1, 1, 1, 0, 0].map((count, i) => ({ date: `d${i}`, count }));
      expect(usage.computeStreaks(broken)).to.deep.equal({ current: 0, longest: 3 });
    });
  });

  describe("csvCell", () => {
    it("quotes separators and neutralises formula injection", () => {
      expect(usage.csvCell('a,"b"')).to.equal('"a,""b"""');
      expect(usage.csvCell("=SUM(A1)")).to.equal("'=SUM(A1)");
      expect(usage.csvCell(null)).to.equal("");
      expect(usage.csvCell(7)).to.equal("7");
    });
  });
});
