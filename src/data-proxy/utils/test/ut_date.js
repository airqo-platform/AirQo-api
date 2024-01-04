const { expect } = require('chai');
const DateUtil = require('../date');

describe('Date Util', () => {
    describe('generateDateFormat', () => {
        it('should return a formatted date string with hours', async () => {
            const ISODate = '2023-09-21T12:34:56Z';
            const result = await DateUtil.generateDateFormat(ISODate);
            expect(result).to.equal('2023-09-21-12');
        });
    });

    describe('isTimeEmpty', () => {
        it('should return false for a valid time', () => {
            const dateTime = '2023-09-21T12:34:56Z';
            const result = DateUtil.isTimeEmpty(dateTime);
            expect(result).to.be.false;
        });

        it('should return true for an empty time', () => {
            const dateTime = '2023-09-21';
            const result = DateUtil.isTimeEmpty(dateTime);
            expect(result).to.be.true;
        });
    });

    describe('generateDateFormatWithoutHrs', () => {
        it('should return a formatted date string without hours', () => {
            const ISODate = '2023-09-21T12:34:56Z';
            const result = DateUtil.generateDateFormatWithoutHrs(ISODate);
            expect(result).to.equal('2023-09-21');
        });
    });

    describe('isDate', () => {
        it('should return true for date strings with "-" or "/"', () => {
            expect(DateUtil.isDate('2023-09-21')).to.be.true;
            expect(DateUtil.isDate('09/21/2023')).to.be.true;
        });

        it('should return false for non-date strings', () => {
            expect(DateUtil.isDate('2023')).to.be.false;
            expect(DateUtil.isDate('Hello, World!')).to.be.false;
        });
    });

    describe('addMonthsToProvideDateTime', () => {
        it('should add months to a provided date/time', () => {
            const dateTime = '2023-09-21T12:34:56Z';
            const number = 3;
            const result = DateUtil.addMonthsToProvideDateTime(dateTime, number);
            expect(result).to.be.a('Date');
        });

        it('should handle empty time and add months to date', () => {
            const date = '2023-09-21';
            const number = 3;
            const result = DateUtil.addMonthsToProvideDateTime(date, number);
            expect(result).to.be.a('Date');
        });
    });

    describe('monthsInfront', () => {
        it('should return a date in the future with the given number of months', () => {
            const number = 3;
            const result = DateUtil.monthsInfront(number);
            expect(result).to.be.a('Date');
        });
    });

    describe('addDays', () => {
        it('should add days to the current date', () => {
            const number = 7;
            const result = DateUtil.addDays(number);
            expect(result).to.be.a('Date');
        });
    });

    describe('getDifferenceInMonths', () => {
        it('should calculate the difference in months between two dates', () => {
            const date1 = '2023-09-21';
            const date2 = '2024-01-15';
            const result = DateUtil.getDifferenceInMonths(date1, date2);
            expect(result).to.equal(4);
        });
    });

    describe('threeMonthsFromNow', () => {
        it('should return a date three months from the provided date', () => {
            const date = '2023-09-21';
            const result = DateUtil.threeMonthsFromNow(date);
            expect(result).to.be.a('Date');
        });
    });

});
