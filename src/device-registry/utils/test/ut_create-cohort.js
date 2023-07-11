require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const faker = require("faker");
const httpStatus = require("http-status");
const createCohort = require("@utils/create-cohort");
const generateFilter = require("@utils/generate-filter");

const expect = chai.expect;

describe("createCohort", () => {
  describe("listNetworks", () => {
    it("should list networks and return success", async () => {
      const tenant = faker.random.word();
      const limit = faker.datatype.number();
      const skip = faker.datatype.number();
      const filter = {};

      const request = {
        query: { tenant, limit, skip },
      };

      sinon.stub(generateFilter, "networks").returns(filter);
      sinon.stub(createCohort, "NetworkModel").returns({
        list: sinon.stub().resolves({ success: true, data: [] }),
      });

      const response = await createCohort.listNetworks(request);

      expect(generateFilter.networks.calledOnce).to.be.true;
      expect(createCohort.NetworkModel.calledOnceWith(tenant)).to.be.true;
      expect(response.success).to.be.true;
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.data).to.deep.equal([]);

      sinon.restore();
    });

    it("should handle filter error", async () => {
      const tenant = faker.random.word();
      const limit = faker.datatype.number();
      const skip = faker.datatype.number();
      const errorMessage = faker.random.words();

      const request = {
        query: { tenant, limit, skip },
      };

      sinon.stub(generateFilter, "networks").returns({
        success: false,
        message: errorMessage,
      });
      sinon.stub(createCohort, "NetworkModel").returns({});

      const response = await createCohort.listNetworks(request);

      expect(generateFilter.networks.calledOnce).to.be.true;
      expect(createCohort.NetworkModel.notCalled).to.be.true;
      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal(errorMessage);

      sinon.restore();
    });

    it("should handle internal server error", async () => {
      const tenant = faker.random.word();
      const limit = faker.datatype.number();
      const skip = faker.datatype.number();
      const errorMessage = faker.random.words();

      const request = {
        query: { tenant, limit, skip },
      };

      sinon.stub(generateFilter, "networks").throws(new Error(errorMessage));
      sinon.stub(createCohort, "NetworkModel").returns({});

      const response = await createCohort.listNetworks(request);

      expect(generateFilter.networks.calledOnce).to.be.true;
      expect(createCohort.NetworkModel.notCalled).to.be.true;
      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal(errorMessage);

      sinon.restore();
    });
  });

  describe("updateNetwork", () => {
    it("should update network and return success", async () => {
      const tenant = faker.random.word();
      const query = { tenant };
      const request = { query };

      const filter = {};
      sinon.stub(generateFilter, "networks").returns(filter);

      const network = { _id: faker.random.alphaNumeric() };
      sinon.stub(createCohort, "NetworkModel").returns({
        find: sinon.stub().returns({ lean: sinon.stub().returns([network]) }),
        findByIdAndUpdate: sinon.stub().resolves(network),
      });

      const body = { name: faker.random.word() };
      const response = await createCohort.updateNetwork({ ...request, body });

      expect(generateFilter.networks.calledOnce).to.be.true;
      expect(createCohort.NetworkModel.calledOnceWith(tenant)).to.be.true;
      expect(response.success).to.be.true;
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.data).to.equal(network);

      sinon.restore();
    });

    it("should handle filter error", async () => {
      const tenant = faker.random.word();
      const query = { tenant };
      const request = { query };

      const errorMessage = faker.random.words();
      sinon.stub(generateFilter, "networks").returns({
        success: false,
        message: errorMessage,
      });

      const response = await createCohort.updateNetwork(request);

      expect(generateFilter.networks.calledOnce).to.be.true;
      expect(createCohort.NetworkModel.notCalled).to.be.true;
      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal(errorMessage);

      sinon.restore();
    });

    it("should handle empty filter", async () => {
      const tenant = faker.random.word();
      const query = { tenant };
      const request = { query };

      sinon.stub(generateFilter, "networks").returns({});
      sinon.stub(createCohort, "NetworkModel").returns({});

      const response = await createCohort.updateNetwork(request);

      expect(generateFilter.networks.calledOnce).to.be.true;
      expect(createCohort.NetworkModel.notCalled).to.be.true;
      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal("Unable to find filter value");

      sinon.restore();
    });

    it("should handle invalid network data", async () => {
      const tenant = faker.random.word();
      const query = { tenant };
      const request = { query };

      const filter = {};
      sinon.stub(generateFilter, "networks").returns(filter);

      const network = [];
      sinon.stub(createCohort, "NetworkModel").returns({
        find: sinon.stub().returns({ lean: sinon.stub().returns(network) }),
      });

      const response = await createCohort.updateNetwork(request);

      expect(generateFilter.networks.calledOnce).to.be.true;
      expect(createCohort.NetworkModel.calledOnceWith(tenant)).to.be.true;
      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.errors.message).to.equal("Invalid Network Data");

      sinon.restore();
    });

    it("should handle network update error", async () => {
      const tenant = faker.random.word();
      const query = { tenant };
      const request = { query };

      const filter = {};
      sinon.stub(generateFilter, "networks").returns(filter);

      const network = { _id: faker.random.alphaNumeric() };
      sinon.stub(createCohort, "NetworkModel").returns({
        find: sinon.stub().returns({ lean: sinon.stub().returns([network]) }),
        findByIdAndUpdate: sinon.stub().resolves(null),
      });

      const body = { name: faker.random.word() };
      const response = await createCohort.updateNetwork({ ...request, body });

      expect(generateFilter.networks.calledOnce).to.be.true;
      expect(createCohort.NetworkModel.calledOnceWith(tenant)).to.be.true;
      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal("unable to update the Network");

      sinon.restore();
    });

    it("should handle internal server error", async () => {
      const tenant = faker.random.word();
      const query = { tenant };
      const request = { query };

      const filter = {};
      sinon
        .stub(generateFilter, "networks")
        .throws(new Error("Internal Server Error"));

      const response = await createCohort.updateNetwork(request);

      expect(generateFilter.networks.calledOnce).to.be.true;
      expect(createCohort.NetworkModel.notCalled).to.be.true;
      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal("Internal Server Error");

      sinon.restore();
    });
  });

  describe("deleteNetwork", () => {
    it("should delete network and return success", async () => {
      const tenant = faker.random.word();
      const query = { tenant };
      const request = { query };

      const filter = {};
      sinon.stub(generateFilter, "networks").returns(filter);

      const network = { _id: faker.random.alphaNumeric() };
      sinon.stub(createCohort, "NetworkModel").returns({
        find: sinon.stub().returns({ lean: sinon.stub().returns([network]) }),
        findByIdAndDelete: sinon.stub().resolves(network),
      });

      const response = await createCohort.deleteNetwork(request);

      expect(generateFilter.networks.calledOnce).to.be.true;
      expect(createCohort.NetworkModel.calledOnceWith(tenant)).to.be.true;
      expect(response.success).to.be.true;
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.data).to.equal(network);

      sinon.restore();
    });

    it("should handle filter error", async () => {
      const tenant = faker.random.word();
      const query = { tenant };
      const request = { query };

      const errorMessage = faker.random.words();
      sinon.stub(generateFilter, "networks").returns({
        success: false,
        message: errorMessage,
      });

      const response = await createCohort.deleteNetwork(request);

      expect(generateFilter.networks.calledOnce).to.be.true;
      expect(createCohort.NetworkModel.notCalled).to.be.true;
      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal(errorMessage);

      sinon.restore();
    });

    it("should handle invalid network data", async () => {
      const tenant = faker.random.word();
      const query = { tenant };
      const request = { query };

      const filter = {};
      sinon.stub(generateFilter, "networks").returns(filter);

      const network = [];
      sinon.stub(createCohort, "NetworkModel").returns({
        find: sinon.stub().returns({ lean: sinon.stub().returns(network) }),
      });

      const response = await createCohort.deleteNetwork(request);

      expect(generateFilter.networks.calledOnce).to.be.true;
      expect(createCohort.NetworkModel.calledOnceWith(tenant)).to.be.true;
      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.errors.message).to.equal("Invalid Network Data");

      sinon.restore();
    });

    it("should handle network deletion error", async () => {
      const tenant = faker.random.word();
      const query = { tenant };
      const request = { query };

      const filter = {};
      sinon.stub(generateFilter, "networks").returns(filter);

      const network = { _id: faker.random.alphaNumeric() };
      sinon.stub(createCohort, "NetworkModel").returns({
        find: sinon.stub().returns({ lean: sinon.stub().returns([network]) }),
        findByIdAndDelete: sinon.stub().resolves(null),
      });

      const response = await createCohort.deleteNetwork(request);

      expect(generateFilter.networks.calledOnce).to.be.true;
      expect(createCohort.NetworkModel.calledOnceWith(tenant)).to.be.true;
      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal("unable to delete the Network");

      sinon.restore();
    });

    it("should handle internal server error", async () => {
      const tenant = faker.random.word();
      const query = { tenant };
      const request = { query };

      const filter = {};
      sinon
        .stub(generateFilter, "networks")
        .throws(new Error("Internal Server Error"));

      const response = await createCohort.deleteNetwork(request);

      expect(generateFilter.networks.calledOnce).to.be.true;
      expect(createCohort.NetworkModel.notCalled).to.be.true;
      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal("Internal Server Error");

      sinon.restore();
    });
  });

  describe("createNetwork", () => {
    it("should create a network and return success", async () => {
      const tenant = faker.random.word();
      const query = { tenant };
      const request = { query };

      const body = { name: faker.random.word() };
      const createdNetwork = { _id: faker.random.alphaNumeric(), ...body };
      sinon.stub(createCohort, "NetworkModel").returns({
        register: sinon.stub().resolves(createdNetwork),
      });

      const response = await createCohort.createNetwork(request);

      expect(createCohort.NetworkModel.calledOnceWith(tenant)).to.be.true;
      expect(response.success).to.be.true;
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.data).to.equal(createdNetwork);

      sinon.restore();
    });

    it("should handle network creation error", async () => {
      const tenant = faker.random.word();
      const query = { tenant };
      const request = { query };

      const errorMessage = faker.random.words();
      sinon.stub(createCohort, "NetworkModel").returns({
        register: sinon.stub().throws(new Error(errorMessage)),
      });

      const response = await createCohort.createNetwork(request);

      expect(createCohort.NetworkModel.calledOnceWith(tenant)).to.be.true;
      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal(errorMessage);

      sinon.restore();
    });

    it("should handle internal server error", async () => {
      const tenant = faker.random.word();
      const query = { tenant };
      const request = { query };

      sinon
        .stub(createCohort, "NetworkModel")
        .throws(new Error("Internal Server Error"));

      const response = await createCohort.createNetwork(request);

      expect(createCohort.NetworkModel.notCalled).to.be.true;
      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal("Internal Server Error");

      sinon.restore();
    });
  });

  describe("create", () => {
    it("should create a cohort and return success", async () => {
      const tenant = faker.random.word();
      const query = { tenant };
      const body = { name: faker.random.word() };
      const request = { query, body };

      const createdCohort = { _id: faker.random.alphaNumeric(), ...body };
      sinon.stub(createCohort, "CohortModel").returns({
        register: sinon.stub().resolves(createdCohort),
      });

      const kafkaProducerStub = sinon.stub().resolves();
      const kafkaSendStub = sinon.stub().resolves();
      const kafkaDisconnectStub = sinon.stub().resolves();
      const kafkaStub = {
        producer: sinon.stub().returns({
          connect: kafkaProducerStub,
          send: kafkaSendStub,
          disconnect: kafkaDisconnectStub,
        }),
      };
      sinon.stub(createCohort, "Kafka").value(kafkaStub);

      const response = await createCohort.create(request);

      expect(createCohort.CohortModel.calledOnceWith(tenant)).to.be.true;
      expect(response.success).to.be.true;
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.data).to.equal(createdCohort);
      expect(kafkaStub.producer.calledOnce).to.be.true;
      expect(kafkaProducerStub.calledOnce).to.be.true;
      expect(kafkaSendStub.calledOnce).to.be.true;
      expect(kafkaDisconnectStub.calledOnce).to.be.true;

      sinon.restore();
    });

    it("should handle cohort creation error", async () => {
      const tenant = faker.random.word();
      const query = { tenant };
      const body = { name: faker.random.word() };
      const request = { query, body };

      const errorMessage = faker.random.words();
      sinon.stub(createCohort, "CohortModel").returns({
        register: sinon.stub().throws(new Error(errorMessage)),
      });

      const kafkaProducerStub = sinon.stub().resolves();
      const kafkaSendStub = sinon.stub().resolves();
      const kafkaDisconnectStub = sinon.stub().resolves();
      const kafkaStub = {
        producer: sinon.stub().returns({
          connect: kafkaProducerStub,
          send: kafkaSendStub,
          disconnect: kafkaDisconnectStub,
        }),
      };
      sinon.stub(createCohort, "Kafka").value(kafkaStub);

      const response = await createCohort.create(request);

      expect(createCohort.CohortModel.calledOnceWith(tenant)).to.be.true;
      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal(errorMessage);
      expect(kafkaStub.producer.notCalled).to.be.true;
      expect(kafkaProducerStub.notCalled).to.be.true;
      expect(kafkaSendStub.notCalled).to.be.true;
      expect(kafkaDisconnectStub.notCalled).to.be.true;

      sinon.restore();
    });

    it("should handle internal server error", async () => {
      const tenant = faker.random.word();
      const query = { tenant };
      const body = { name: faker.random.word() };
      const request = { query, body };

      sinon
        .stub(createCohort, "CohortModel")
        .throws(new Error("Internal Server Error"));

      const kafkaProducerStub = sinon.stub().resolves();
      const kafkaSendStub = sinon.stub().resolves();
      const kafkaDisconnectStub = sinon.stub().resolves();
      const kafkaStub = {
        producer: sinon.stub().returns({
          connect: kafkaProducerStub,
          send: kafkaSendStub,
          disconnect: kafkaDisconnectStub,
        }),
      };
      sinon.stub(createCohort, "Kafka").value(kafkaStub);

      const response = await createCohort.create(request);

      expect(createCohort.CohortModel.notCalled).to.be.true;
      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal("Internal Server Error");
      expect(kafkaStub.producer.notCalled).to.be.true;
      expect(kafkaProducerStub.notCalled).to.be.true;
      expect(kafkaSendStub.notCalled).to.be.true;
      expect(kafkaDisconnectStub.notCalled).to.be.true;

      sinon.restore();
    });
  });

  describe("update", () => {
    it("should update a cohort and return success", async () => {
      const tenant = faker.random.word();
      const query = { tenant };
      const body = { name: faker.random.word() };
      const request = { query, body };

      const filter = {};
      sinon.stub(generateFilter, "cohorts").returns(filter);

      const update = { name: faker.random.word() };
      sinon.stub(createCohort, "CohortModel").returns({
        modify: sinon.stub().resolves({ success: true }),
      });

      const response = await createCohort.update(request);

      expect(generateFilter.cohorts.calledOnce).to.be.true;
      expect(createCohort.CohortModel.calledOnceWith(tenant)).to.be.true;
      expect(response.success).to.be.true;
      expect(response.status).to.equal(httpStatus.OK);

      sinon.restore();
    });

    it("should handle filter error", async () => {
      const tenant = faker.random.word();
      const query = { tenant };
      const body = { name: faker.random.word() };
      const request = { query, body };

      const errorMessage = faker.random.words();
      sinon.stub(generateFilter, "cohorts").returns({
        success: false,
        message: errorMessage,
      });

      const response = await createCohort.update(request);

      expect(generateFilter.cohorts.calledOnce).to.be.true;
      expect(createCohort.CohortModel.notCalled).to.be.true;
      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal(errorMessage);

      sinon.restore();
    });

    it("should handle empty filter", async () => {
      const tenant = faker.random.word();
      const query = { tenant };
      const body = { name: faker.random.word() };
      const request = { query, body };

      sinon.stub(generateFilter, "cohorts").returns({});
      sinon.stub(createCohort, "CohortModel").returns({});

      const response = await createCohort.update(request);

      expect(generateFilter.cohorts.calledOnce).to.be.true;
      expect(createCohort.CohortModel.notCalled).to.be.true;
      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal("Unable to find filter value");

      sinon.restore();
    });

    it("should handle cohort update error", async () => {
      const tenant = faker.random.word();
      const query = { tenant };
      const body = { name: faker.random.word() };
      const request = { query, body };

      const filter = {};
      sinon.stub(generateFilter, "cohorts").returns(filter);

      const errorMessage = faker.random.words();
      sinon.stub(createCohort, "CohortModel").returns({
        modify: sinon
          .stub()
          .resolves({ success: false, message: errorMessage }),
      });

      const response = await createCohort.update(request);

      expect(generateFilter.cohorts.calledOnce).to.be.true;
      expect(createCohort.CohortModel.calledOnceWith(tenant)).to.be.true;
      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal(errorMessage);

      sinon.restore();
    });

    it("should handle internal server error", async () => {
      const tenant = faker.random.word();
      const query = { tenant };
      const body = { name: faker.random.word() };
      const request = { query, body };

      const filter = {};
      sinon
        .stub(generateFilter, "cohorts")
        .throws(new Error("Internal Server Error"));

      const response = await createCohort.update(request);

      expect(generateFilter.cohorts.calledOnce).to.be.true;
      expect(createCohort.CohortModel.notCalled).to.be.true;
      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal("Internal Server Error");

      sinon.restore();
    });
  });
});

describe("generateFilter", () => {
  describe("networks", () => {
    it("should generate a filter object with network fields", () => {
      const tenant = faker.random.word();
      const limit = faker.datatype.number();
      const skip = faker.datatype.number();

      const result = generateFilter.networks(tenant, limit, skip);

      expect(result.tenant).to.equal(tenant);
      expect(result.limit).to.equal(limit);
      expect(result.skip).to.equal(skip);
    });

    it("should generate a filter object without optional fields", () => {
      const tenant = faker.random.word();

      const result = generateFilter.networks(tenant);

      expect(result.tenant).to.equal(tenant);
      expect(result.limit).to.be.undefined;
      expect(result.skip).to.be.undefined;
    });
  });

  describe("cohorts", () => {
    it("should generate a filter object with cohort fields", () => {
      const tenant = faker.random.word();
      const networkId = faker.random.alphaNumeric();
      const limit = faker.datatype.number();
      const skip = faker.datatype.number();

      const result = generateFilter.cohorts(tenant, networkId, limit, skip);

      expect(result.tenant).to.equal(tenant);
      expect(result.networkId).to.equal(networkId);
      expect(result.limit).to.equal(limit);
      expect(result.skip).to.equal(skip);
    });

    it("should generate a filter object without optional fields", () => {
      const tenant = faker.random.word();
      const networkId = faker.random.alphaNumeric();

      const result = generateFilter.cohorts(tenant, networkId);

      expect(result.tenant).to.equal(tenant);
      expect(result.networkId).to.equal(networkId);
      expect(result.limit).to.be.undefined;
      expect(result.skip).to.be.undefined;
    });
  });
});
