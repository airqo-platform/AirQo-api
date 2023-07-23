process.env.NODE_ENV = "development";

require('dotenv').config();
require("module-alias/register");
const chai = require("chai");
const chaiHttp = require("chai-http");
const should = chai.should();
const expect = chai.expect;
const assert = chai.assert;
const faker = require("faker");
const sinon = require("sinon");
chai.use(chaiHttp);

const dateUtil = require("@utils/date");

describe("Date Utils", function () {
    describe("generateDateFormat", function () {
        it("should return a string with the correct format", function () {
            const ISODate = "2020-10-01T00:00:00.000Z";
            const result = dateUtil.generateDateFormat(ISODate);
            expect(result).to.equal("2020-10-01-3");
        });

        it('should return an empty string for invalid input', function () {
            const ISODate = '2023-13-01T10:00:00.000Z';
            const expected = 'NaN-NaN-NaN-NaN';
            const result = dateUtil.generateDateFormat(ISODate);
            assert.strictEqual(result, expected);
        });
    }
    );
    describe("isTimeEmpty", function () {
        it('should return true for an empty string input', function () {
            const time = "";
            const result = dateUtil.isTimeEmpty(time);
            expect(result).to.be.true;
        });

        it("should return false if the time is not empty", function () {
            const time = '2023-05-16T10:30:00.000Z';
            const result = dateUtil.isTimeEmpty(time);
            expect(result).to.be.false;
        });

    }
    );

    describe("formatDate", function () {
        it('should format the date correctly', function () {
            const dateTime = '2023-05-16T10:30:00.000Z';
            const result = dateUtil.formatDate(dateTime);
            assert.strictEqual(result, '2023-05-16T10:30:00.000Z');
        });

    });


    describe('generateDateFormatWithoutHrs', function () {
        it('should generate the date format without hours correctly', function () {
            const ISODate = '2023-05-16T10:30:00.000Z';
            const result = dateUtil.generateDateFormatWithoutHrs(ISODate);
            assert.strictEqual(result, '2023-05-16');
        });

        it('should generate the date format without hours for a single-digit day and month', function () {
            const ISODate = '2023-05-06T15:45:00.000Z';
            const result = dateUtil.generateDateFormatWithoutHrs(ISODate);
            assert.strictEqual(result, '2023-05-06');
        });

        it('should return invalid date for an empty string input', function () {
            const ISODate = '';
            const result = dateUtil.generateDateFormatWithoutHrs(ISODate);
            assert.strictEqual(result, 'NaN-NaN-NaN');
        });

    });

    describe("addMonthsToProvideDateTime", function () {
        it('should add the months correctly', function () {
            const dateTime = '2023-05-16T10:30:00.000Z';
            const number = 10;
            const result = dateUtil.addMonthsToProvideDateTime(dateTime, number);
            assert.strictEqual(`${result}`, 'Sat Mar 16 2024 13:30:00 GMT+0300 (East Africa Time)');
        });


        it('should add positive number of months correctly when the time is empty', function () {
            const dateTime = '2023-05-16';
            const number = 2;
            const result = dateUtil.addMonthsToProvideDateTime(dateTime, number);
            assert.strictEqual(`${result}`, 'Sun Jul 16 2023 03:00:00 GMT+0300 (East Africa Time)');
        });


        it('should return invalid date for an empty string dateTime', function () {
            const dateTime = '';
            const number = 2;
            const result = dateUtil.addMonthsToProvideDateTime(dateTime, number);
            assert.strictEqual(result, '-0NaN-undefined');
        });

    }
    );

    describe('monthsInfront', function () {
        it('should return the date that is N months in front of the current date', function () {
            const number = 2;
            const result = dateUtil.monthsInfront(number);
            const currentDate = new Date();
            const targetMonth = currentDate.getMonth() + number;
            currentDate.setMonth(targetMonth);
            if (currentDate.getMonth() !== targetMonth % 12) {
                currentDate.setDate(0);
            }
            assert.strictEqual(result.toISOString(), currentDate.toISOString());
        });

        it('should return the date that is N months behind the current date', function () {
            const number = -3;
            const result = dateUtil.monthsInfront(number);
            const currentDate = new Date();
            const targetMonth = currentDate.getMonth() + number;
            currentDate.setMonth(targetMonth);
            if (currentDate.getMonth() !== targetMonth % 12) {
                currentDate.setDate(0);
            }
            assert.strictEqual(result.toISOString(), currentDate.toISOString());
        });
    });

    describe('addDays', function () {
        it('should return the date N days from the current date', function () {
            const number = 5;
            const result = dateUtil.addDays(number);
            const currentDate = new Date();
            const expectedDate = new Date(currentDate.getTime() + number * 24 * 60 * 60 * 1000);
            assert.strictEqual(result.toISOString(), expectedDate.toISOString());
        });
    });

    describe('addHours', function () {
        it('should return the date N hours from the current time', function () {
            const number = 3;
            const result = dateUtil.addHours(number);
            const currentTime = new Date();
            const expectedTime = new Date(currentTime.getTime() + number * 60 * 60 * 1000);
            assert.strictEqual(result.toISOString(), expectedTime.toISOString());
        });
    });

    describe('addMinutes', function () {
        it('should return the date N minutes from the current time', function () {
            const number = 10;
            const result = dateUtil.addMinutes(number);
            const currentTime = new Date();
            const expectedTime = new Date(currentTime.getTime() + number * 60 * 1000);
            assert.strictEqual(result.toISOString(), expectedTime.toISOString());
        });
    });

    describe('getDifferenceInMonths', function () {
        it('should return the number of months between two dates', function () {
            const d1 = '2022-05-10';
            const d2 = '2023-08-15';
            const result = dateUtil.getDifferenceInMonths(d1, d2);
            const expectedMonths = 15;
            assert.strictEqual(result, expectedMonths);
        });

        it('should return 0 if the second date is before or the same as the first date', function () {
            const d1 = '2023-10-20';
            const d2 = '2023-08-10';
            const result = dateUtil.getDifferenceInMonths(d1, d2);
            const expectedMonths = 0;
            assert.strictEqual(result, expectedMonths);
        });
    });

    describe('threeMonthsFromNow', function () {
        it('should return the date that is three months from the provided date', function () {
            const date = '2023-05-10';
            const result = dateUtil.threeMonthsFromNow(date);
            const expectedDate = new Date('2023-08-10');
            assert.strictEqual(result.toISOString(), expectedDate.toISOString());
        });

        it('should return the last day of the previous month if the result month does not exist', function () {
            const date = '2023-01-31';
            const result = dateUtil.threeMonthsFromNow(date);
            const expectedDate = new Date('2023-04-30');
            assert.strictEqual(result.toISOString(), expectedDate.toISOString());
        });
    });


});