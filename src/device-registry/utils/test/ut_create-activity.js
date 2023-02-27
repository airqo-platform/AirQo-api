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
const deviceModel = require("@models/SiteActivity");
const deviceUtil = require("@utils/create-activity");

const stubValue = {
  _id: faker.datatype.uuid(),
  name:faker.name.findName(),
  tenant: "test",
  device: faker.datatype.string(),
  is_device_primary: faker.datatype.boolean(),
  device_id: faker.datatype.uuid(),
  site_id:faker.datatype.uuid(),
  createdAt: faker.date.past(),
  updatedAt: faker.date.past(),
  latitude:faker.address.latitude(),
  longitude: faker.address.longitude(),
};

describe("create Activity util", function() {

});
