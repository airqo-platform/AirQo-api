require("module-alias/register");
const { expect } = require("chai");
const date = require("@utils/common/date");

// Tolerance for comparing "now + n" results against a separately-read clock.
const CLOCK_TOLERANCE_MS = 1000;

// Run fn with process.env.TZ temporarily set (Node re-reads TZ on change).
const withTimezone = (tz, fn) => {
  const original = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
};

describe("date", () => {
  describe("generateDateFormat", () => {
    it("should generate date format with hours", () => {
      const result = date.generateDateFormat("2023-07-04T12:34:56.789Z");

      expect(result).to.equal("2023-07-04-12");
    });

    it("should use UTC for every part regardless of host timezone", () => {
      // 22:00Z on Jan 31 is already Feb 1 in Kampala (UTC+3).
      const result = withTimezone("Africa/Kampala", () =>
        date.generateDateFormat("2023-01-31T22:00:00.000Z"),
      );

      expect(result).to.equal("2023-01-31-22");
    });
  });

  describe("generateDateFormatWithoutHrs", () => {
    it("should generate date format without hours", () => {
      const ISODate = "2023-07-04T12:34:56.789Z";

      const result = date.generateDateFormatWithoutHrs(ISODate);

      expect(result).to.equal("2023-07-04");
    });

    it("should not mix local month with UTC day near a month boundary", () => {
      // Previously produced the impossible date "2023-02-31" on UTC+3 hosts.
      const result = withTimezone("Africa/Kampala", () =>
        date.generateDateFormatWithoutHrs("2023-01-31T22:00:00.000Z"),
      );

      expect(result).to.equal("2023-01-31");
    });
  });

  describe("isTimeEmpty", () => {
    it("should return false when time is not empty", () => {
      const result = date.isTimeEmpty("2023-07-04T12:34:56.789Z");

      expect(result).to.be.false;
    });

    it("should treat invalid input as empty time", () => {
      const result = date.isTimeEmpty("invalid-date-time");

      expect(result).to.be.true;
    });
  });

  describe("formatDate", () => {
    it("should format the date to ISO string", () => {
      const dateTime = "2023-07-04T12:34:56.789Z";

      const result = date.formatDate(dateTime);

      expect(result).to.equal(dateTime);
    });
  });

  describe("addDays", () => {
    it("should return a date that is `number` days ahead of the current date", () => {
      const daysToAdd = 5;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysToAdd);

      const result = date.addDays(daysToAdd);

      expect(result.getTime()).to.be.closeTo(
        targetDate.getTime(),
        CLOCK_TOLERANCE_MS,
      );
    });
  });

  describe("addHours", () => {
    it("should return a date that is `number` hours ahead of the current date", () => {
      const hoursToAdd = 3;
      const target = Date.now() + hoursToAdd * 60 * 60 * 1000;

      const result = date.addHours(hoursToAdd);

      expect(result.getTime()).to.be.closeTo(target, CLOCK_TOLERANCE_MS);
    });
  });

  describe("addMinutes", () => {
    it("should return a date that is `number` minutes ahead of the current date", () => {
      const minutesToAdd = 30;
      const target = Date.now() + minutesToAdd * 60 * 1000;

      const result = date.addMinutes(minutesToAdd);

      expect(result.getTime()).to.be.closeTo(target, CLOCK_TOLERANCE_MS);
    });
  });

  describe("getDifferenceInMonths", () => {
    it("should return 0 for the same dates", () => {
      const result = date.getDifferenceInMonths("2023-01-15", "2023-01-15");

      expect(result).to.equal(0);
    });
  });

  describe("threeMonthsFromNow", () => {
    it("should return a date three months from the provided date", () => {
      const result = date.threeMonthsFromNow("2023-01-15");

      expect(result.toISOString()).to.equal(
        new Date("2023-04-15").toISOString(),
      );
    });

    it("should handle leap years and return a valid date", () => {
      const result = date.threeMonthsFromNow("2024-01-29");

      expect(result.toISOString()).to.equal(
        new Date("2024-04-29").toISOString(),
      );
    });

    it("should clamp to the last day of the target month", () => {
      // Nov 30 + 3 months has no Feb 30, so it clamps to Feb 29 (leap year).
      const result = date.threeMonthsFromNow("2023-11-30");

      expect(result.toISOString()).to.equal(
        new Date("2024-02-29").toISOString(),
      );
    });
  });
});
