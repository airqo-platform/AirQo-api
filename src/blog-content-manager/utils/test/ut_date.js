require("module-alias/register");
const sinon = require("sinon");
const { expect } = require("chai");
const utils = require("@utils/date");

describe("monthsFromNow", () => {
  it("should return the current date for invalid input", () => {
    const result = utils.monthsFromNow("invalid");
    const currentDate = new Date();
    expect(result).to.be.instanceOf(Date);
    expect(result.getFullYear()).to.equal(currentDate.getFullYear());
    expect(result.getMonth()).to.equal(currentDate.getMonth());
    expect(result.getDate()).to.equal(currentDate.getDate());
  });

  it("should return a date 'n' months from now", () => {
    const numMonths = 3;
    const result = utils.monthsFromNow(numMonths);
    const currentDate = new Date();
    const expectedMonth = currentDate.getMonth() + numMonths;
    currentDate.setMonth(expectedMonth);
    if (currentDate.getMonth() !== expectedMonth % 12) {
      currentDate.setDate(0);
    }
    expect(result).to.be.instanceOf(Date);
    expect(result.getFullYear()).to.equal(currentDate.getFullYear());
    expect(result.getMonth()).to.equal(currentDate.getMonth());
    expect(result.getDate()).to.equal(currentDate.getDate());
  });

  it("should return the last day of the month if the calculated month is invalid", () => {
    const numMonths = 14; // 14 months from now is equivalent to 2 months from now
    const result = utils.monthsFromNow(numMonths);
    const currentDate = new Date();
    const expectedMonth = currentDate.getMonth() + numMonths;
    currentDate.setMonth(expectedMonth);
    currentDate.setDate(0); // Set the date to the last day of the previous month
    expect(result).to.be.instanceOf(Date);
    expect(result.getFullYear()).to.equal(currentDate.getFullYear());
    expect(result.getMonth()).to.equal(currentDate.getMonth());
    expect(result.getDate()).to.equal(currentDate.getDate());
  });
});

describe("isTimeEmpty", () => {
  it("should return true for an invalid date", () => {
    const result = utils.isTimeEmpty("invalid");
    expect(result).to.be.true;
  });

  it("should return false for a valid date with non-empty time", () => {
    const dateTime = "2023-07-25T12:34:56.789Z";
    const result = utils.isTimeEmpty(dateTime);
    expect(result).to.be.false;
  });

  it("should return true for a valid date with empty time", () => {
    const dateOnly = "2023-07-25";
    const result = utils.isTimeEmpty(dateOnly);
    expect(result).to.be.true;
  });
});

describe("formatDate", () => {
  it("should return a formatted date string for a valid date", () => {
    const dateTime = "2023-07-25T12:34:56.789Z";
    const result = utils.formatDate(dateTime);
    expect(result).to.be.a("string");
    expect(result).to.equal("2023-07-25T12:34:56.789Z");
  });

  it("should return a formatted date string for a valid date with empty time", () => {
    const dateOnly = "2023-07-25";
    const result = utils.formatDate(dateOnly);
    expect(result).to.be.a("string");
    expect(result).to.equal("2023-07-25T00:00:00.000Z");
  });

  it("should return 'Invalid Date' for an invalid date", () => {
    const invalidDate = "invalid";
    const result = utils.formatDate(invalidDate);
    expect(result).to.be.a("string");
    expect(result).to.equal("Invalid Date");
  });
});

describe("generateDateFormatWithoutHrs", () => {
  it("should return a formatted date string without hours for a valid date", () => {
    const ISODate = "2023-07-25T12:34:56.789Z";
    const result = utils.generateDateFormatWithoutHrs(ISODate);
    expect(result).to.be.a("string");
    expect(result).to.equal("2023-07-25");
  });

  it("should return a formatted date string without hours for a valid date with single-digit day and month", () => {
    const ISODate = "2023-07-05T00:00:00.000Z";
    const result = utils.generateDateFormatWithoutHrs(ISODate);
    expect(result).to.be.a("string");
    expect(result).to.equal("2023-07-05");
  });

  it("should return 'Invalid Date' for an invalid date", () => {
    const invalidDate = "invalid";
    const result = utils.generateDateFormatWithoutHrs(invalidDate);
    expect(result).to.be.a("string");
    expect(result).to.equal("Invalid Date");
  });
});

describe("addMonthsToProvidedDate", () => {
  it("should add the specified number of months to the provided date", () => {
    const date = "2023-07-25";
    const number = 3;
    const result = utils.addMonthsToProvidedDate(date, number);
    expect(result).to.be.a("string");
    expect(result).to.equal("2023-10-25");
  });

  it("should handle single-digit months correctly", () => {
    const date = "2023-07-25";
    const number = 8;
    const result = utils.addMonthsToProvidedDate(date, number);
    expect(result).to.be.a("string");
    expect(result).to.equal("2024-03-25");
  });

  it("should handle cases where the new month has single-digit representation", () => {
    const date = "2023-11-05";
    const number = 2;
    const result = utils.addMonthsToProvidedDate(date, number);
    expect(result).to.be.a("string");
    expect(result).to.equal("2024-01-05");
  });

  it("should handle cases where the new month exceeds 12", () => {
    const date = "2023-10-31";
    const number = 5;
    const result = utils.addMonthsToProvidedDate(date, number);
    expect(result).to.be.a("string");
    expect(result).to.equal("2024-03-31");
  });

  it("should handle cases where the provided date is at the end of the month", () => {
    const date = "2023-07-31";
    const number = 2;
    const result = utils.addMonthsToProvidedDate(date, number);
    expect(result).to.be.a("string");
    expect(result).to.equal("2023-09-30");
  });

  it("should handle cases with negative number of months", () => {
    const date = "2023-12-25";
    const number = -2;
    const result = utils.addMonthsToProvidedDate(date, number);
    expect(result).to.be.a("string");
    expect(result).to.equal("2023-10-25");
  });

  it("should return 'Invalid Date' for an invalid date", () => {
    const invalidDate = "invalid";
    const number = 2;
    const result = utils.addMonthsToProvidedDate(invalidDate, number);
    expect(result).to.be.a("string");
    expect(result).to.equal("Invalid Date");
  });
});

describe("addMonthsToProvideDateTime", () => {
  const originalIsTimeEmpty = utils.isTimeEmpty;
  const originalAddMonthsToProvidedDate = utils.addMonthsToProvidedDate;

  beforeEach(() => {
    // Stub the isTimeEmpty and addMonthsToProvidedDate functions
    sinon.stub(utils, "isTimeEmpty");
    sinon.stub(utils, "addMonthsToProvidedDate");
  });

  afterEach(() => {
    // Restore the original functions after each test
    sinon.restore();
  });

  it("should add the specified number of months to the provided date and time if the time is not empty", () => {
    const dateTime = "2023-07-25T10:30:00Z";
    const number = 3;
    const expectedDate = new Date("2023-10-25T10:30:00Z");
    utils.isTimeEmpty.returns(false);
    const result = utils.addMonthsToProvideDateTime(dateTime, number);
    expect(result).to.be.a("Date");
    expect(result.toISOString()).to.equal(expectedDate.toISOString());
  });

  it("should call addMonthsToProvidedDate and return the result if the time is empty", () => {
    const dateTime = "2023-07-25";
    const number = 3;
    const expectedDate = "2023-10-25";
    utils.isTimeEmpty.returns(true);
    utils.addMonthsToProvidedDate.returns(expectedDate);
    const result = utils.addMonthsToProvideDateTime(dateTime, number);
    expect(result).to.be.a("string");
    expect(result).to.equal(expectedDate);
    expect(
      utils.addMonthsToProvidedDate.calledOnceWithExactly(dateTime, number)
    ).to.be.true;
  });

  it("should return 'Invalid Date' if the provided date is invalid", () => {
    const invalidDateTime = "invalid";
    const number = 3;
    utils.isTimeEmpty.returns(false);
    const result = utils.addMonthsToProvideDateTime(invalidDateTime, number);
    expect(result).to.equal("Invalid Date");
  });
});

describe("monthsInfront", () => {
  it("should return a new date with the specified number of months in front of the current date", () => {
    const number = 3;
    const currentDate = new Date();
    const expectedDate = new Date(currentDate);
    expectedDate.setMonth(currentDate.getMonth() + number);
    if (expectedDate.getMonth() !== (currentDate.getMonth() + number) % 12) {
      expectedDate.setDate(0);
    }
    const result = utils.monthsInfront(number);
    expect(result).to.be.a("Date");
    expect(result.toISOString()).to.equal(expectedDate.toISOString());
  });

  it("should handle negative numbers correctly and return a new date with the specified number of months in front of the current date", () => {
    const number = -3;
    const currentDate = new Date();
    const expectedDate = new Date(currentDate);
    expectedDate.setMonth(currentDate.getMonth() + number);
    if (expectedDate.getMonth() !== (currentDate.getMonth() + number) % 12) {
      expectedDate.setDate(0);
    }
    const result = utils.monthsInfront(number);
    expect(result).to.be.a("Date");
    expect(result.toISOString()).to.equal(expectedDate.toISOString());
  });
});
describe("addDays", () => {
  it("should return a new date with the specified number of days added to the current date", () => {
    const number = 5;
    const currentDate = new Date();
    const expectedDate = new Date(currentDate);
    expectedDate.setDate(currentDate.getDate() + number);
    const result = utils.addDays(number);
    expect(result).to.be.a("Date");
    expect(result.toISOString()).to.equal(expectedDate.toISOString());
  });

  it("should handle negative numbers correctly and return a new date with the specified number of days subtracted from the current date", () => {
    const number = -5;
    const currentDate = new Date();
    const expectedDate = new Date(currentDate);
    expectedDate.setDate(currentDate.getDate() + number);
    const result = utils.addDays(number);
    expect(result).to.be.a("Date");
    expect(result.toISOString()).to.equal(expectedDate.toISOString());
  });
});

describe("addHours", () => {
  it("should return a new date with the specified number of hours added to the current date", () => {
    const number = 3;
    const currentTime = new Date();
    const expectedTime = new Date(
      currentTime.getTime() + number * 60 * 60 * 1000
    );
    const result = utils.addHours(number);
    expect(result).to.be.a("Date");
    expect(result.toISOString()).to.equal(expectedTime.toISOString());
  });

  it("should handle negative numbers correctly and return a new date with the specified number of hours subtracted from the current date", () => {
    const number = -3;
    const currentTime = new Date();
    const expectedTime = new Date(
      currentTime.getTime() + number * 60 * 60 * 1000
    );
    const result = utils.addHours(number);
    expect(result).to.be.a("Date");
    expect(result.toISOString()).to.equal(expectedTime.toISOString());
  });
});

describe("addMinutes", () => {
  it("should return a new date with the specified number of minutes added to the current date", () => {
    const number = 30;
    const currentTime = new Date();
    const expectedTime = new Date(currentTime.getTime() + number * 60 * 1000);
    const result = utils.addMinutes(number);
    expect(result).to.be.a("Date");
    expect(result.toISOString()).to.equal(expectedTime.toISOString());
  });

  it("should handle negative numbers correctly and return a new date with the specified number of minutes subtracted from the current date", () => {
    const number = -30;
    const currentTime = new Date();
    const expectedTime = new Date(currentTime.getTime() + number * 60 * 1000);
    const result = utils.addMinutes(number);
    expect(result).to.be.a("Date");
    expect(result.toISOString()).to.equal(expectedTime.toISOString());
  });
});

describe("getDifferenceInMonths", () => {
  it("should return the correct difference in months when d2 is greater than d1", () => {
    const d1 = "2023-01-15"; // January 15, 2023
    const d2 = "2023-04-30"; // April 30, 2023
    const expectedMonths = 3;
    const result = utils.getDifferenceInMonths(d1, d2);
    expect(result).to.equal(expectedMonths);
  });

  it("should return the correct difference in months when d1 is greater than d2", () => {
    const d1 = "2023-04-30"; // April 30, 2023
    const d2 = "2023-01-15"; // January 15, 2023
    const expectedMonths = 3;
    const result = utils.getDifferenceInMonths(d1, d2);
    expect(result).to.equal(expectedMonths);
  });

  it("should return 0 when d1 and d2 are the same date", () => {
    const d1 = "2023-05-10"; // May 10, 2023
    const d2 = "2023-05-10"; // May 10, 2023
    const expectedMonths = 0;
    const result = utils.getDifferenceInMonths(d1, d2);
    expect(result).to.equal(expectedMonths);
  });
});

describe("threeMonthsFromNow", () => {
  it("should return the correct date three months from the provided date", () => {
    const providedDate = "2023-07-15"; // July 15, 2023
    const expectedDate = "2023-10-15"; // October 15, 2023
    const result = utils.threeMonthsFromNow(providedDate);
    expect(result.toISOString().slice(0, 10)).to.equal(expectedDate);
  });

  it("should return the correct date three months from the last day of the month", () => {
    const providedDate = "2023-05-31"; // May 31, 2023 (last day of the month)
    const expectedDate = "2023-08-31"; // August 31, 2023 (last day of the month)
    const result = utils.threeMonthsFromNow(providedDate);
    expect(result.toISOString().slice(0, 10)).to.equal(expectedDate);
  });

  it("should return the correct date three months from the last day of February (leap year)", () => {
    const providedDate = "2024-02-29"; // February 29, 2024 (last day of February in a leap year)
    const expectedDate = "2024-05-29"; // May 29, 2024
    const result = utils.threeMonthsFromNow(providedDate);
    expect(result.toISOString().slice(0, 10)).to.equal(expectedDate);
  });

  it("should return the correct date three months from the last day of February (non-leap year)", () => {
    const providedDate = "2023-02-28"; // February 28, 2023 (last day of February in a non-leap year)
    const expectedDate = "2023-05-28"; // May 28, 2023
    const result = utils.threeMonthsFromNow(providedDate);
    expect(result.toISOString().slice(0, 10)).to.equal(expectedDate);
  });
});

// Add other describe blocks and test cases for the remaining functions in the file
