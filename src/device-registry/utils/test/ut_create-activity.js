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
const deviceUtil = require("@utils/create-device");
const activityUtil = require("@utils/create-activity");
const httpStatus = require("http-status");
const ActivityModel = require("@utils/multitenancy");
const date = require("@utils/date");
const siteUtil = require("@utils/create-site");

const stubValue = {
  tenant: "test",
  device: faker.name.findName(),
  site_id:faker.datatype.uuid(),
  createdAt: faker.date.past(),
  date:faker.date.past(),
  description: faker.datatype.string(),
  network: faker.datatype.string(),
  activityType:faker.datatype.string(),
  activity_codes: [
      faker.datatype.string(),faker.datatype.string()
    ],
  tags: [faker.datatype.string(),faker.datatype.string()],
  nextMaintenance:faker.date.past(),
  maintenanceType: faker.datatype.string(),
  latitude: faker.address.latitude(),
  longitude: faker.address.longitude(),
};

describe("create Activity util", function () {
 afterEach(() => {
    sinon.restore();
  });

  describe("create function", () => {
    let request = {
      query: {
        type: "",
        deviceName: "",
        tenant: "",
      },
    };

    afterEach(() => {
      sinon.restore();
    });

    it("should recall, maintain or deploy device depending on the type of the query", async () => {
      let recallResult, deployResult, maintainResult;
      request.query.deviceName = stubValue.device;
      request.query.tenant = stubValue.tenant;
      const doesDeviceSearchExistStub = sinon.stub(deviceUtil, "doesDeviceSearchExist").returns({
        success: false,
        message: "search does not exist",
        data: [],
      });
      for (let i = 0; i < 3; i++){
        switch (i) {
          case 0: request.query.type = "recall";
            sinon.stub(activityUtil, "recall").returns({
                success: true,
                message: "successfully recalled the device",
                data: stubValue,
            });
           recallResult = await activityUtil.create(request);
            break;
          case 1: request.query.type = "deploy";
            sinon.stub(activityUtil, "deploy").returns({
                success: true,
                message: "successfully deployed the device",
                data: stubValue,
            });
           deployResult = await activityUtil.create(request);
            break;
          case 2: request.query.type = "maintain";
            sinon.stub(activityUtil, "maintain").returns({
                success: true,
                message: "successfully maintained the device",
                data: stubValue,
            });
             maintainResult = await activityUtil.create(request);
        }

      }
      expect(recallResult.success).to.equal(true);
      expect(deployResult.success).to.equal(true);
      expect(deployResult.success).to.equal(true);
    });

   
    it("should return error message if doesDeviceSearchExist returns success true for recall type", async () => {
      request.query.type = "recall";
      request.query.deviceName = stubValue.device;

      sinon.stub(deviceUtil, "doesDeviceSearchExist").resolves({ success: true });

      const expectedResponse = {
        success: false,
        message: `Device ${stubValue.device} already recalled`,
        status: httpStatus.CONFLICT,
      };

      const response = await activityUtil.create(request);

      assert.deepStrictEqual(response, expectedResponse);
    });

  });

  describe('recall function', function () {
    const request = {
      query: {
        tenant: stubValue.tenant,
        deviceName: stubValue.device,
      }
    };
      it('should return a success response if the device is recalled successfully', async function() {

        sinon.stub(ActivityModel, "getModelByTenant").returns(
          {
              success: true,
              data:stubValue,
              message: "Activity created",
              status: httpStatus.CREATED,
            }
        );
        sinon.stub(deviceUtil, "updateOnPlatform").returns(
          {
              success: true,
              message: " ",
              data:stubValue,
              status: httpStatus.OK,
            }
        );

        const response = await activityUtil.recall(request);
        expect(response.success).to.be.true;
        expect(response.message).to.equal('successfully recalled the device');
        expect(response.data).to.be.an('object');
      }).timeout(5000);
  });

  describe("maintain Function", function () {
    const request = {
      body: {
        date: stubValue.nextMaintenance,
        tags: stubValue.tags,
        description: stubValue.description,
        maintenanceType: stubValue.maintenanceType,
        network: stubValue.network,
      },
      query: {
        tenant: stubValue.tenant,
        deviceName: stubValue.device,
      },
    };

    it("should return successfully maintained the device", async function () {
      sinon.stub(ActivityModel, "getModelByTenant").returns(
        {
          success: true,
          data: stubValue,
          message: "Activity created",
          status: httpStatus.CREATED,
        }
      );
      sinon.stub(deviceUtil, "updateOnPlatform").returns(
        {
          success: true,
          message: " ",
          data: stubValue,
          status: httpStatus.OK,
        }
      );
      sinon.stub(date, "addMonthsToProvideDateTime").returns(stubValue.nextMaintenance);

      const response = await activityUtil.maintain(request);


      expect(response.success).to.be.true;
      expect(response.message).to.equal('successfully maintained the device');
      expect(response.data).to.be.an('object');
    }).timeout(5000);
  });

  describe("deploy Function", function () {
    const request = {
      body: {
        date: stubValue.nextMaintenance,
        tags: stubValue.tags,
        description: stubValue.description,
        maintenanceType: stubValue.maintenanceType,
        network: stubValue.network,
        height:0,
        mountType:faker.datatype.string(),
        powerType:faker.datatype.string(),
        isPrimaryInLocation:faker.datatype.boolean(),
      },
      query: {
        tenant: stubValue.tenant,
        deviceName: stubValue.device,
      },
    };

    it("should return successfully deployed the device", async function () {
      sinon.stub(siteUtil, "list").returns(
        {
          success: true,
          data: [stubValue],
          message: " ",
          status: httpStatus.OK,
        }
      );
      sinon.stub(ActivityModel, "getModelByTenant").returns(
        {
          success: true,
          data: stubValue,
          message: "Activity created",
          status: httpStatus.CREATED,
        }
      );
      sinon.stub(deviceUtil, "updateOnPlatform").returns(
        {
          success: true,
          message: " ",
          data: stubValue,
          status: httpStatus.OK,
        }
      );
      sinon.stub(date, "addMonthsToProvideDateTime").returns(stubValue.nextMaintenance);

      const response = await activityUtil.deploy(request);


      expect(response.success).to.be.true;
      expect(response.message).to.be.equal("successfully deployed the device");
    }).timeout(5000);
  });

});
