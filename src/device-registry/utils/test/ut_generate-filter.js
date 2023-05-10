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
const HTTPStatus = require("http-status");

const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const {
  monthsInfront,
  addMonthsToProvideDateTime,
  isTimeEmpty,
  generateDateFormatWithoutHrs,
  getDifferenceInMonths,
  addDays,
  addHours,
} = require("@utils/date");
const generateFilterUtil = require("@utils/generate-filter");

const stubValue = {
    _id: faker.datatype.uuid(),
    name: faker.name.findName(),
    tenant: "test",
    device: faker.datatype.string(),
    is_device_primary: faker.datatype.boolean(),
    device_id: faker.datatype.uuid(),
    site_id: faker.datatype.uuid(),
    startTime: faker.date.past(),
    endTime: faker.date.past(),
    latitude: faker.address.latitude(),
    longitude: faker.address.longitude(),
    site: faker.datatype.string(),
    frequency: faker.datatype.string(),
    device_number: faker.datatype.string(),
    index: 'good',
};

describe("Generate Filter Util", function () {
    describe('events', function () {
       
        let today = monthsInfront(0);
        let oneWeekBack = addDays(-7);
        let oneMonthBack = monthsInfront(-1);
        let threeHoursBack = addHours(-3);
        it('should generate the filter with default values when no query parameters are provided', function () {
            const request = { query: {} };
            const result = generateFilterUtil.events(request);
            console.log(result);
            expect(result.success).to.be.true;
            expect(result.data.day).to.deep.equal({
               
                    $gte: generateDateFormatWithoutHrs(oneWeekBack),
                    $lte: generateDateFormatWithoutHrs(today),
               
            });
            expect(result.data).to.contain({
                "device": false,
                "external": "yes",
                "frequency": "hourly",
                "values.frequency": "hourly",
            });
            expect(result.message).to.equal('filter successfully generated');
        });


        it('should generate the filter with the provided query parameters', function () {
            delete stubValue['device_number'];
            delete stubValue['device_id'];
            delete stubValue['site_id'];
            const request = {
                query: stubValue,
            };
            const result = generateFilterUtil.events(request);
            console.log(result.data);
            expect(result.success).to.be.true;
            expect(result.message).to.equal('filter successfully generated');
        });

        it('should handle errors and return a failure response', function () {
            const request = { };
            const error = new Error('Some error message');
        
            const result = generateFilterUtil.events(request);

            expect(result.success).to.be.false;
            expect(result.message).to.equal('unable to generate the filter');
        });
    });

});