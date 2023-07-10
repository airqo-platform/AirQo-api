require("module-alias/register");
const chai = require("chai");
const chaiHttp = require("chai-http");
const sinon = require("sinon");
const faker = require("faker");
const geolib = require("geolib");
const { Kafka } = require("kafkajs");

const createAirqloud = require("@utils/create-airqloud");

const expect = chai.expect;
chai.use(chaiHttp);

describe("createAirqloud", () => {
  describe("initialIsCapital", () => {
    it("should return true if the first character of the word is capitalized", () => {
      const result = createAirqloud.initialIsCapital("Word");
      expect(result).to.be.true;
    });

    it("should return false if the first character of the word is not capitalized", () => {
      const result = createAirqloud.initialIsCapital("word");
      expect(result).to.be.false;
    });
  });

  describe("hasNoWhiteSpace", () => {
    it("should return true if the word does not contain any whitespace", () => {
      const result = createAirqloud.hasNoWhiteSpace("word");
      expect(result).to.be.true;
    });

    it("should return false if the word contains whitespace", () => {
      const result = createAirqloud.hasNoWhiteSpace("word with space");
      expect(result).to.be.false;
    });
  });

  describe("retrieveCoordinates", () => {
    it("should return location data if the response from list is successful and data is not empty", async () => {
      const request = {
        /* mock request object */
      };
      const entity = "location";
      const responseFromListAirQloud = {
        success: true,
        data: [
          {
            location: {
              /* location data */
            },
          },
        ],
      };

      const entityInstance = {
        list: sinon.stub().resolves(responseFromListAirQloud),
      };

      const expectedResponse = {
        success: true,
        data: responseFromListAirQloud.data[0].location,
        message: "retrieved the location",
        status: 200,
      };

      const result = await createAirqloud.retrieveCoordinates(
        request,
        entityInstance,
        entity
      );
      expect(result).to.deep.equal(expectedResponse);
    });

    it("should return an error message if the response from list is successful but data is empty", async () => {
      const request = {
        /* mock request object */
      };
      const entity = "location";
      const responseFromListAirQloud = {
        success: true,
        data: [],
      };

      const entityInstance = {
        list: sinon.stub().resolves(responseFromListAirQloud),
      };

      const expectedResponse = {
        success: false,
        message: "unable to retrieve location details",
        status: 404,
        errors: {
          message: "no record exists for this location_id",
        },
      };

      const result = await createAirqloud.retrieveCoordinates(
        request,
        entityInstance,
        entity
      );
      expect(result).to.deep.equal(expectedResponse);
    });

    it("should return an error message if the response from list has more than one data", async () => {
      const request = {
        /* mock request object */
      };
      const entity = "location";
      const responseFromListAirQloud = {
        success: true,
        data: [
          {
            /* location data 1 */
          },
          {
            /* location data 2 */
          },
        ],
      };

      const entityInstance = {
        list: sinon.stub().resolves(responseFromListAirQloud),
      };

      const expectedResponse = {
        success: false,
        message: "unable to retrieve location details",
        status: 500,
        errors: {
          message: "requested for one record but received many",
        },
      };

      const result = await createAirqloud.retrieveCoordinates(
        request,
        entityInstance,
        entity
      );
      expect(result).to.deep.equal(expectedResponse);
    });

    it("should return an error message if the response from list is unsuccessful", async () => {
      const request = {
        /* mock request object */
      };
      const entity = "location";
      const responseFromListAirQloud = {
        success: false,
        errors: {
          /* error object */
        },
      };

      const entityInstance = {
        list: sinon.stub().resolves(responseFromListAirQloud),
      };

      const expectedResponse = {
        success: false,
        message: "unable to retrieve details from the provided location_id",
        status: 500,
        errors: responseFromListAirQloud.errors,
      };

      const result = await createAirqloud.retrieveCoordinates(
        request,
        entityInstance,
        entity
      );
      expect(result).to.deep.equal(expectedResponse);
    });

    it("should return an error message if an error occurs during execution", async () => {
      const request = {
        /* mock request object */
      };
      const entity = "location";

      const entityInstance = {
        list: sinon.stub().throws(new Error("Internal Server Error")),
      };

      const expectedResponse = {
        success: false,
        message: "Internal Server Error",
        status: 500,
        errors: {
          message: "Internal Server Error",
        },
      };

      const result = await createAirqloud.retrieveCoordinates(
        request,
        entityInstance,
        entity
      );
      expect(result).to.deep.equal(expectedResponse);
    });
  });

  describe("create", () => {
    it("should create a new airqloud with modified body and return the response", async () => {
      const request = {
        /* mock request object */
      };
      const body = {
        /* mock request body */
      };
      const query = {
        /* mock request query */
      };
      request.body = body;
      request.query = query;

      const location_id = faker.random.uuid();
      body.location_id = location_id;

      const responseFromRetrieveCoordinates = {
        success: true,
        data: {
          /* location data */
        },
      };

      const responseFromCalculateGeographicalCenter = {
        success: true,
        data: {
          /* center point data */
        },
      };

      const responseFromRegisterAirQloud = {
        success: true,
        data: {
          /* created airqloud data */
        },
      };

      sinon
        .stub(createAirqloud, "retrieveCoordinates")
        .resolves(responseFromRetrieveCoordinates);
      sinon
        .stub(createAirqloud, "calculateGeographicalCenter")
        .resolves(responseFromCalculateGeographicalCenter);
      sinon.stub(createAirqloud, "getModelByTenant").resolves({
        register: sinon.stub().resolves(responseFromRegisterAirQloud),
      });

      const kafkaProducerStub = {
        connect: sinon.stub().resolves(),
        send: sinon.stub().resolves(),
        disconnect: sinon.stub().resolves(),
      };

      const kafkaStub = {
        producer: sinon.stub().returns(kafkaProducerStub),
      };

      sinon.stub(createAirqloud, "Kafka").returns(kafkaStub);

      const expectedResponse = responseFromRegisterAirQloud;

      const result = await createAirqloud.create(request);
      expect(result).to.deep.equal(expectedResponse);

      createAirqloud.retrieveCoordinates.restore();
      createAirqloud.calculateGeographicalCenter.restore();
      createAirqloud.getModelByTenant.restore();
      createAirqloud.Kafka.restore();
    });
  });
});
