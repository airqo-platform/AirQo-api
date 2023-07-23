require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const dateUtil = require("@utils/date");
const log4js = require("log4js");

describe("dateUtil", () => {
  describe("generateDateFormat", () => {
    it("should generate date format with hours", () => {
      const ISODate = "2023-07-04T12:34:56.789Z";
      const expectedResult = "2023-07-04-12";

      const result = dateUtil.generateDateFormat(ISODate);

      expect(result).to.equal(expectedResult);
    });

    it("should handle invalid input and log error", () => {
      const ISODate = "invalid-date";
      const logErrorStub = sinon.stub(log4js.getLogger(), "error");

      const result = dateUtil.generateDateFormat(ISODate);

      expect(result).to.be.undefined;
      expect(logErrorStub.calledOnce).to.be.true;

      logErrorStub.restore();
    });
  });
  describe("generateDateFormatWithoutHrs", () => {
    it("should generate date format without hours", () => {
      const ISODate = "2023-07-04T12:34:56.789Z";
      const expectedResult = "2023-07-04";

      const result = dateUtil.generateDateFormatWithoutHrs(ISODate);

      expect(result).to.equal(expectedResult);
    });

    it("should handle invalid input and log error", () => {
      const ISODate = "invalid-date";
      const logErrorStub = sinon.stub(log4js.getLogger(), "error");

      const result = dateUtil.generateDateFormatWithoutHrs(ISODate);

      expect(result).to.be.undefined;
      expect(logErrorStub.calledOnce).to.be.true;

      logErrorStub.restore();
    });
  });
  describe("addMonthsToProvideDateTime", () => {
    it("should add months to the provided date with time", () => {
      const dateTime = "2023-07-04T12:34:56.789Z";
      const number = 3;
      const expectedResult = new Date("2023-10-04T12:34:56.789Z");

      const result = dateUtil.addMonthsToProvideDateTime(dateTime, number);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should add months to the provided date without time", () => {
      const dateTime = "2023-07-04";
      const number = 3;
      const expectedResult = new Date("2023-10-04");

      const result = dateUtil.addMonthsToProvideDateTime(dateTime, number);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should handle invalid input and log error", () => {
      const dateTime = "invalid-date";
      const number = 3;
      const logErrorStub = sinon.stub(log4js.getLogger(), "error");

      const result = dateUtil.addMonthsToProvideDateTime(dateTime, number);

      expect(result).to.be.undefined;
      expect(logErrorStub.calledOnce).to.be.true;

      logErrorStub.restore();
    });
  });
  describe("isTimeEmpty", () => {
    it("should return false when time is not empty", () => {
      const dateTime = "2023-07-04T12:34:56.789Z";

      const result = dateUtil.isTimeEmpty(dateTime);

      expect(result).to.be.false;
    });

    it("should return true when time is empty", () => {
      const dateOnly = "2023-07-04";

      const result = dateUtil.isTimeEmpty(dateOnly);

      expect(result).to.be.true;
    });

    it("should handle invalid input and log error", () => {
      const invalidDateTime = "invalid-date-time";
      const logErrorStub = sinon.stub(log4js.getLogger(), "error");

      const result = dateUtil.isTimeEmpty(invalidDateTime);

      expect(result).to.be.true;
      expect(logErrorStub.calledOnce).to.be.true;

      logErrorStub.restore();
    });
  });
  describe("formatDate", () => {
    it("should format the date to ISO string", () => {
      const dateTime = "2023-07-04T12:34:56.789Z";

      const result = dateUtil.formatDate(dateTime);

      expect(result).to.equal(dateTime);
    });

    it("should handle invalid input and log error", () => {
      const invalidDateTime = "invalid-date-time";
      const logErrorStub = sinon.stub(log4js.getLogger(), "error");

      const result = dateUtil.formatDate(invalidDateTime);

      expect(result).to.be.undefined;
      expect(logErrorStub.calledOnce).to.be.true;

      logErrorStub.restore();
    });
  });
  describe("addMonthsToProvidedDate", () => {
    it("should add months to the provided date", () => {
      const inputDate = "2023-07-04";
      const monthsToAdd = 3;

      const result = dateUtil.addMonthsToProvidedDate(inputDate, monthsToAdd);

      expect(result).to.equal("2023-10-04");
    });

    it("should handle invalid input and log error", () => {
      const invalidDate = "invalid-date";
      const monthsToAdd = 3;
      const logErrorStub = sinon.stub(log4js.getLogger(), "error");

      const result = dateUtil.addMonthsToProvidedDate(invalidDate, monthsToAdd);

      expect(result).to.be.undefined;
      expect(logErrorStub.calledOnce).to.be.true;

      logErrorStub.restore();
    });
  });
  describe("monthsInfront", () => {
    it("should return a date that is `number` months in front of the current date", () => {
      const monthsToAdd = 3;

      const result = dateUtil.monthsInfront(monthsToAdd);

      const currentDate = new Date();
      const targetDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + monthsToAdd,
        0
      );

      expect(result).to.eql(targetDate);
    });

    it("should handle invalid input and log error", () => {
      const invalidNumber = "invalid-number";
      const logErrorStub = sinon.stub(log4js.getLogger(), "error");

      const result = dateUtil.monthsInfront(invalidNumber);

      expect(result).to.be.undefined;
      expect(logErrorStub.calledOnce).to.be.true;

      logErrorStub.restore();
    });
  });
  describe("addDays", () => {
    it("should return a date that is `number` days ahead of the current date", () => {
      const daysToAdd = 5;

      const result = dateUtil.addDays(daysToAdd);

      const currentDate = new Date();
      const targetDate = new Date(currentDate);
      targetDate.setDate(currentDate.getDate() + daysToAdd);

      expect(result).to.eql(targetDate);
    });

    it("should handle invalid input and log error", () => {
      const invalidNumber = "invalid-number";
      const logErrorStub = sinon.stub(log4js.getLogger(), "error");

      const result = dateUtil.addDays(invalidNumber);

      expect(result).to.be.undefined;
      expect(logErrorStub.calledOnce).to.be.true;

      logErrorStub.restore();
    });
  });
  describe("addHours", () => {
    it("should return a date that is `number` hours ahead of the current date", () => {
      const hoursToAdd = 3;

      const result = dateUtil.addHours(hoursToAdd);

      const currentDate = new Date();
      const targetDate = new Date(
        currentDate.getTime() + hoursToAdd * 60 * 60 * 1000
      );

      expect(result).to.eql(targetDate);
    });

    it("should handle invalid input and log error", () => {
      const invalidNumber = "invalid-number";
      const logErrorStub = sinon.stub(log4js.getLogger(), "error");

      const result = dateUtil.addHours(invalidNumber);

      expect(result).to.be.undefined;
      expect(logErrorStub.calledOnce).to.be.true;

      logErrorStub.restore();
    });
  });
  describe("addMinutes", () => {
    it("should return a date that is `number` minutes ahead of the current date", () => {
      const minutesToAdd = 30;

      const result = dateUtil.addMinutes(minutesToAdd);

      const currentDate = new Date();
      const targetDate = new Date(
        currentDate.getTime() + minutesToAdd * 60 * 1000
      );

      expect(result).to.eql(targetDate);
    });

    it("should handle invalid input and log error", () => {
      const invalidNumber = "invalid-number";
      const logErrorStub = sinon.stub(log4js.getLogger(), "error");

      const result = dateUtil.addMinutes(invalidNumber);

      expect(result).to.be.undefined;
      expect(logErrorStub.calledOnce).to.be.true;

      logErrorStub.restore();
    });
  });
  describe("getDifferenceInMonths", () => {
    it("should return the difference in months between two dates", () => {
      const date1 = "2023-01-15";
      const date2 = "2023-05-10";

      const result = dateUtil.getDifferenceInMonths(date1, date2);

      expect(result).to.equal(3); // Difference between Jan and May is 3 months
    });

    it("should return 0 for the same dates", () => {
      const date1 = "2023-01-15";
      const date2 = "2023-01-15";

      const result = dateUtil.getDifferenceInMonths(date1, date2);

      expect(result).to.equal(0);
    });

    it("should handle invalid input and return 0", () => {
      const date1 = "invalid-date";
      const date2 = "2023-01-15";

      const result = dateUtil.getDifferenceInMonths(date1, date2);

      expect(result).to.equal(0);
    });
  });
  describe("threeMonthsFromNow", () => {
    it("should return a date three months from the provided date", () => {
      const date = "2023-01-15";
      const result = dateUtil.threeMonthsFromNow(date);
      const expectedDate = new Date("2023-04-15");

      expect(result.toISOString()).to.equal(expectedDate.toISOString());
    });

    it("should handle leap years and return a valid date", () => {
      const date = "2024-01-29"; // Leap year
      const result = dateUtil.threeMonthsFromNow(date);
      const expectedDate = new Date("2024-04-29");

      expect(result.toISOString()).to.equal(expectedDate.toISOString());
    });

    it("should handle edge cases and return a valid date", () => {
      const date = "2023-11-30"; // Last day of November
      const result = dateUtil.threeMonthsFromNow(date);
      const expectedDate = new Date("2024-02-29"); // Leap year

      expect(result.toISOString()).to.equal(expectedDate.toISOString());
    });
  });

  // Add tests for other functions in date-util
  // ...
});
