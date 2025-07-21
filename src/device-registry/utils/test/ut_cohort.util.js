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
    it("should list networks successfully", async () => {
      // Arrange
      const request = {
        query: {
          tenant: "sample_tenant",
          limit: 10,
          skip: 0,
          // Add any other required parameters for the request here
        },
      };

      // Stub the generateFilter.networks function to return the filter
      const generateFilterStub = chai.spy.on(
        createCohort,
        "generateFilter",
        () => ({
          success: true,
          // Add the filter data here
        })
      );

      // Stub the NetworkModel.list function to return the response
      const listStub = chai.spy.on(
        createCohort.NetworkModel("sample_tenant"),
        "list",
        () => ({
          success: true,
          // Add the response data here
        })
      );

      // Act
      const result = await createCohort.listNetworks(request);

      // Assert
      expect(result.success).to.be.true;
      // Add additional assertions based on the response data

      // Restore the stubs
      createCohort.generateFilter.restore();
      createCohort.NetworkModel("sample_tenant").list.restore();
    });

    it("should handle listNetworks error", async () => {
      // Arrange
      const request = {
        query: {
          tenant: "sample_tenant",
          limit: 10,
          skip: 0,
          // Add any other required parameters for the request here
        },
      };

      // Stub the generateFilter.networks function to return the filter
      const generateFilterStub = chai.spy.on(
        createCohort,
        "generateFilter",
        () => ({
          success: true,
          // Add the filter data here
        })
      );

      // Stub the NetworkModel.list function to throw an error
      const listStub = chai.spy.on(
        createCohort.NetworkModel("sample_tenant"),
        "list",
        () => {
          throw new Error("Network list error");
        }
      );

      // Act
      const result = await createCohort.listNetworks(request);

      // Assert
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.errors.message).to.equal("Network list error");

      // Restore the stubs
      createCohort.generateFilter.restore();
      createCohort.NetworkModel("sample_tenant").list.restore();
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

  describe("delete", () => {
    it("should delete cohort successfully", async () => {
      // Arrange
      const request = {
        query: {
          tenant: "sample_tenant",
          // Add any other required parameters for the request here
        },
        // Add any other required properties for the request here
      };

      // Stub the generateFilter.cohorts function to return the filter
      const generateFilterStub = chai.spy.on(
        createCohort,
        "generateFilter",
        () => ({
          success: true,
          // Add the filter data here
        })
      );

      // Stub the CohortModel.remove function to return the response
      const removeStub = chai.spy.on(
        createCohort.CohortModel("sample_tenant"),
        "remove",
        () => ({
          success: true,
          // Add the response data here
        })
      );

      // Act
      const result = await createCohort.delete(request);

      // Assert
      expect(result.success).to.be.true;
      // Add additional assertions based on the response data

      // Restore the stubs
      createCohort.generateFilter.restore();
      createCohort.CohortModel("sample_tenant").remove.restore();
    });

    it("should handle delete error", async () => {
      // Arrange
      const request = {
        query: {
          tenant: "sample_tenant",
          // Add any other required parameters for the request here
        },
        // Add any other required properties for the request here
      };

      // Stub the generateFilter.cohorts function to return the filter
      const generateFilterStub = chai.spy.on(
        createCohort,
        "generateFilter",
        () => ({
          success: true,
          // Add the filter data here
        })
      );

      // Stub the CohortModel.remove function to throw an error
      const removeStub = chai.spy.on(
        createCohort.CohortModel("sample_tenant"),
        "remove",
        () => {
          throw new Error("Cohort remove error");
        }
      );

      // Act
      const result = await createCohort.delete(request);

      // Assert
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.errors.message).to.equal("Cohort remove error");

      // Restore the stubs
      createCohort.generateFilter.restore();
      createCohort.CohortModel("sample_tenant").remove.restore();
    });
  });

  describe("list", () => {
    it("should list cohorts successfully", async () => {
      // Arrange
      const request = {
        query: {
          tenant: "sample_tenant",
          // Add any other required parameters for the request here
        },
        // Add any other required properties for the request here
      };

      // Stub the generateFilter.cohorts function to return the filter
      const generateFilterStub = chai.spy.on(
        createCohort,
        "generateFilter",
        () => ({
          success: true,
          // Add the filter data here
        })
      );

      // Stub the CohortModel.list function to return the response
      const listStub = chai.spy.on(
        createCohort.CohortModel("sample_tenant"),
        "list",
        () => ({
          success: true,
          // Add the response data here
        })
      );

      // Act
      const result = await createCohort.list(request);

      // Assert
      expect(result.success).to.be.true;
      // Add additional assertions based on the response data

      // Restore the stubs
      createCohort.generateFilter.restore();
      createCohort.CohortModel("sample_tenant").list.restore();
    });

    it("should handle list error", async () => {
      // Arrange
      const request = {
        query: {
          tenant: "sample_tenant",
          // Add any other required parameters for the request here
        },
        // Add any other required properties for the request here
      };

      // Stub the generateFilter.cohorts function to return the filter
      const generateFilterStub = chai.spy.on(
        createCohort,
        "generateFilter",
        () => ({
          success: true,
          // Add the filter data here
        })
      );

      // Stub the CohortModel.list function to throw an error
      const listStub = chai.spy.on(
        createCohort.CohortModel("sample_tenant"),
        "list",
        () => {
          throw new Error("Cohort list error");
        }
      );

      // Act
      const result = await createCohort.list(request);

      // Assert
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.errors.message).to.equal("Cohort list error");

      // Restore the stubs
      createCohort.generateFilter.restore();
      createCohort.CohortModel("sample_tenant").list.restore();
    });
  });

  describe("listAvailableDevices", () => {
    it("should list available devices for a cohort successfully", async () => {
      // Arrange
      const request = {
        query: {
          tenant: "sample_tenant",
          // Add any other required parameters for the request here
        },
        params: {
          cohort_id: "sample_cohort_id",
          // Add any other required parameters for the request here
        },
        // Add any other required properties for the request here
      };

      // Mock the CohortModel.findById function to return a valid cohort
      const findByIdStub = chai.spy.on(
        createCohort.CohortModel("sample_tenant"),
        "findById",
        () => ({
          _id: "sample_cohort_id",
          // Add any other cohort data here
        })
      );

      // Mock the DeviceModel.aggregate function to return the list of available devices
      const aggregateStub = chai.spy.on(
        createCohort.DeviceModel("sample_tenant"),
        "aggregate",
        () => [
          {
            _id: "sample_device_id",
            long_name: "Sample Device",
            name: "device1",
            description: "Sample device description",
            createdAt: "2023-07-04 12:34:56", // Modify as needed
          },
          // Add more devices as needed
        ]
      );

      // Act
      const result = await createCohort.listAvailableDevices(request);

      // Assert
      expect(result.success).to.be.true;
      // Add additional assertions based on the response data

      // Restore the stubs
      createCohort.CohortModel("sample_tenant").findById.restore();
      createCohort.DeviceModel("sample_tenant").aggregate.restore();
    });

    it("should handle invalid cohort ID", async () => {
      // Arrange
      const request = {
        query: {
          tenant: "sample_tenant",
          // Add any other required parameters for the request here
        },
        params: {
          cohort_id: "invalid_cohort_id",
          // Add any other required parameters for the request here
        },
        // Add any other required properties for the request here
      };

      // Mock the CohortModel.findById function to return null (invalid cohort ID)
      const findByIdStub = chai.spy.on(
        createCohort.CohortModel("sample_tenant"),
        "findById",
        () => null
      );

      // Act
      const result = await createCohort.listAvailableDevices(request);

      // Assert
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Bad Request Error");
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.errors.message).to.equal(
        "Invalid cohort ID invalid_cohort_id, please crosscheck"
      );

      // Restore the stubs
      createCohort.CohortModel("sample_tenant").findById.restore();
      createCohort.DeviceModel("sample_tenant").aggregate.restore();
    });

    // Add more test cases as needed for different scenarios
  });

  describe("listAvailableDevices", () => {
    it("should list available devices for a cohort successfully", async () => {
      // Arrange
      const request = {
        query: {
          tenant: "sample_tenant",
          // Add any other required parameters for the request here
        },
        params: {
          cohort_id: "sample_cohort_id",
          // Add any other required parameters for the request here
        },
        // Add any other required properties for the request here
      };

      // Mock the CohortModel.findById function to return a valid cohort
      const findByIdStub = chai.spy.on(
        createCohort.CohortModel("sample_tenant"),
        "findById",
        () => ({
          _id: "sample_cohort_id",
          // Add any other cohort data here
        })
      );

      // Mock the DeviceModel.aggregate function to return the list of available devices
      const aggregateStub = chai.spy.on(
        createCohort.DeviceModel("sample_tenant"),
        "aggregate",
        () => [
          {
            _id: "sample_device_id",
            long_name: "Sample Device",
            name: "device1",
            description: "Sample device description",
            createdAt: "2023-07-04 12:34:56", // Modify as needed
          },
          // Add more devices as needed
        ]
      );

      // Act
      const result = await createCohort.listAvailableDevices(request);

      // Assert
      expect(result.success).to.be.true;
      // Add additional assertions based on the response data

      // Restore the stubs
      createCohort.CohortModel("sample_tenant").findById.restore();
      createCohort.DeviceModel("sample_tenant").aggregate.restore();
    });

    it("should handle invalid cohort ID", async () => {
      // Arrange
      const request = {
        query: {
          tenant: "sample_tenant",
          // Add any other required parameters for the request here
        },
        params: {
          cohort_id: "invalid_cohort_id",
          // Add any other required parameters for the request here
        },
        // Add any other required properties for the request here
      };

      // Mock the CohortModel.findById function to return null (invalid cohort ID)
      const findByIdStub = chai.spy.on(
        createCohort.CohortModel("sample_tenant"),
        "findById",
        () => null
      );

      // Act
      const result = await createCohort.listAvailableDevices(request);

      // Assert
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Bad Request Error");
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.errors.message).to.equal(
        "Invalid cohort ID invalid_cohort_id, please crosscheck"
      );

      // Restore the stubs
      createCohort.CohortModel("sample_tenant").findById.restore();
      createCohort.DeviceModel("sample_tenant").aggregate.restore();
    });

    // Add more test cases as needed for different scenarios
  });
  describe("assignManyDevicesToCohort", () => {
    it("should assign devices to a cohort successfully", async () => {
      // Arrange
      const request = {
        params: {
          cohort_id: "sample_cohort_id",
        },
        body: {
          device_ids: [
            "sample_device_id_1",
            "sample_device_id_2",
            "sample_device_id_3",
          ],
        },
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the CohortModel.findById function to return a valid cohort
      const findByIdCohortStub = chai.spy.on(
        createCohort.CohortModel("sample_tenant"),
        "findById",
        () => ({
          _id: "sample_cohort_id",
          // Add any other cohort data here
        })
      );

      // Mock the DeviceModel.findById function to return valid devices
      const findByIdDeviceStub = chai.spy.on(
        createCohort.DeviceModel("sample_tenant"),
        "findById",
        (deviceId) => ({
          _id: deviceId,
          cohorts: [], // Set the initial cohorts array to be empty
          // Add any other device data here
        })
      );

      // Mock the DeviceModel.updateMany function to return the number of modified documents
      const updateManyStub = chai.spy.on(
        createCohort.DeviceModel("sample_tenant"),
        "updateMany",
        () => ({
          nModified: 3, // Number of documents modified
          n: 3, // Total number of matching documents
        })
      );

      // Act
      const result = await createCohort.assignManyDevicesToCohort(request);

      // Assert
      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "successfully assigned all the provided devices to the Cohort"
      );
      expect(result.status).to.equal(httpStatus.OK);
      // Add additional assertions based on the response data

      // Restore the stubs
      createCohort.CohortModel("sample_tenant").findById.restore();
      createCohort.DeviceModel("sample_tenant").findById.restore();
      createCohort.DeviceModel("sample_tenant").updateMany.restore();
    });

    it("should handle invalid cohort ID", async () => {
      // Arrange
      const request = {
        params: {
          cohort_id: "invalid_cohort_id",
        },
        body: {
          device_ids: [
            "sample_device_id_1",
            "sample_device_id_2",
            "sample_device_id_3",
          ],
        },
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the CohortModel.findById function to return null (invalid cohort ID)
      const findByIdCohortStub = chai.spy.on(
        createCohort.CohortModel("sample_tenant"),
        "findById",
        () => null
      );

      // Act
      const result = await createCohort.assignManyDevicesToCohort(request);

      // Assert
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Bad Request Error");
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.errors.message).to.equal(
        "Invalid cohort ID invalid_cohort_id"
      );

      // Restore the stubs
      createCohort.CohortModel("sample_tenant").findById.restore();
      createCohort.DeviceModel("sample_tenant").findById.restore();
      createCohort.DeviceModel("sample_tenant").updateMany.restore();
    });

    it("should handle invalid device IDs", async () => {
      // Arrange
      const request = {
        params: {
          cohort_id: "sample_cohort_id",
        },
        body: {
          device_ids: [
            "invalid_device_id_1",
            "invalid_device_id_2",
            "invalid_device_id_3",
          ],
        },
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the CohortModel.findById function to return a valid cohort
      const findByIdCohortStub = chai.spy.on(
        createCohort.CohortModel("sample_tenant"),
        "findById",
        () => ({
          _id: "sample_cohort_id",
          // Add any other cohort data here
        })
      );

      // Mock the DeviceModel.findById function to return null (invalid device ID)
      const findByIdDeviceStub = chai.spy.on(
        createCohort.DeviceModel("sample_tenant"),
        "findById",
        () => null
      );

      // Act
      const result = await createCohort.assignManyDevicesToCohort(request);

      // Assert
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Bad Request Error");
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.errors.message).to.equal(
        "Invalid Device ID invalid_device_id_1, please crosscheck"
      );

      // Restore the stubs
      createCohort.CohortModel("sample_tenant").findById.restore();
      createCohort.DeviceModel("sample_tenant").findById.restore();
      createCohort.DeviceModel("sample_tenant").updateMany.restore();
    });

    // Add more test cases as needed for different scenarios
  });

  describe("unAssignManyDevicesFromCohort", () => {
    it("should unassign devices from a cohort successfully", async () => {
      // Arrange
      const request = {
        params: {
          cohort_id: "sample_cohort_id",
        },
        body: {
          device_ids: [
            "sample_device_id_1",
            "sample_device_id_2",
            "sample_device_id_3",
          ],
        },
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the CohortModel.findById function to return a valid cohort
      const findByIdCohortStub = chai.spy.on(
        createCohort.CohortModel("sample_tenant"),
        "findById",
        () => ({
          _id: "sample_cohort_id",
          // Add any other cohort data here
        })
      );

      // Mock the DeviceModel.find function to return existing devices
      const findDeviceStub = chai.spy.on(
        createCohort.DeviceModel("sample_tenant"),
        "find",
        () => [
          { _id: "sample_device_id_1" },
          { _id: "sample_device_id_2" },
          { _id: "sample_device_id_3" },
        ]
      );

      // Mock the DeviceModel.updateMany function to return the number of modified documents
      const updateManyStub = chai.spy.on(
        createCohort.DeviceModel("sample_tenant"),
        "updateMany",
        () => ({
          nModified: 3, // Number of documents modified
          n: 3, // Total number of matching documents
        })
      );

      // Act
      const result = await createCohort.unAssignManyDevicesFromCohort(request);

      // Assert
      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "successfully unassigned all the provided devices from the cohort sample_cohort_id"
      );
      expect(result.status).to.equal(httpStatus.OK);
      // Add additional assertions based on the response data

      // Restore the stubs
      unAssignManyDevicesFromCohort
        .CohortModel("sample_tenant")
        .findById.restore();
      createCohort.DeviceModel("sample_tenant").find.restore();
      unAssignManyDevicesFromCohort
        .DeviceModel("sample_tenant")
        .updateMany.restore();
    });

    it("should handle invalid cohort ID", async () => {
      // Arrange
      const request = {
        params: {
          cohort_id: "invalid_cohort_id",
        },
        body: {
          device_ids: [
            "sample_device_id_1",
            "sample_device_id_2",
            "sample_device_id_3",
          ],
        },
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the CohortModel.findById function to return null (invalid cohort ID)
      const findByIdCohortStub = chai.spy.on(
        createCohort.CohortModel("sample_tenant"),
        "findById",
        () => null
      );

      // Act
      const result = await createCohort.unAssignManyDevicesFromCohort(request);

      // Assert
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Bad Request Error");
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.errors.message).to.equal("Cohort not found");

      // Restore the stubs
      unAssignManyDevicesFromCohort
        .CohortModel("sample_tenant")
        .findById.restore();
      createCohort.DeviceModel("sample_tenant").find.restore();
      unAssignManyDevicesFromCohort
        .DeviceModel("sample_tenant")
        .updateMany.restore();
    });

    it("should handle non-existent devices", async () => {
      // Arrange
      const request = {
        params: {
          cohort_id: "sample_cohort_id",
        },
        body: {
          device_ids: [
            "invalid_device_id_1",
            "invalid_device_id_2",
            "invalid_device_id_3",
          ],
        },
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the CohortModel.findById function to return a valid cohort
      const findByIdCohortStub = chai.spy.on(
        createCohort.CohortModel("sample_tenant"),
        "findById",
        () => ({
          _id: "sample_cohort_id",
          // Add any other cohort data here
        })
      );

      // Mock the DeviceModel.find function to return existing devices
      const findDeviceStub = chai.spy.on(
        createCohort.DeviceModel("sample_tenant"),
        "find",
        () => []
      );

      // Act
      const result = await createCohort.unAssignManyDevicesFromCohort(request);

      // Assert
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Bad Request Error");
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.errors.message).to.equal(
        "The following devices do not exist: invalid_device_id_1, invalid_device_id_2, invalid_device_id_3"
      );

      // Restore the stubs
      unAssignManyDevicesFromCohort
        .CohortModel("sample_tenant")
        .findById.restore();
      createCohort.DeviceModel("sample_tenant").find.restore();
      unAssignManyDevicesFromCohort
        .DeviceModel("sample_tenant")
        .updateMany.restore();
    });

    it("should handle devices not assigned to the cohort", async () => {
      // Arrange
      const request = {
        params: {
          cohort_id: "sample_cohort_id",
        },
        body: {
          device_ids: [
            "sample_device_id_1",
            "sample_device_id_2",
            "sample_device_id_3",
          ],
        },
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the CohortModel.findById function to return a valid cohort
      const findByIdCohortStub = chai.spy.on(
        createCohort.CohortModel("sample_tenant"),
        "findById",
        () => ({
          _id: "sample_cohort_id",
          // Add any other cohort data here
        })
      );

      // Mock the DeviceModel.find function to return existing devices (but not assigned to the cohort)
      const findDeviceStub = chai.spy.on(
        createCohort.DeviceModel("sample_tenant"),
        "find",
        () => [
          { _id: "sample_device_id_1" },
          { _id: "sample_device_id_2" },
          { _id: "sample_device_id_3" },
        ]
      );

      // Act
      const result = await createCohort.unAssignManyDevicesFromCohort(request);

      // Assert
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Bad Request Error");
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.errors.message).to.equal(
        "Some of the provided Device IDs are not assigned to this cohort sample_cohort_id"
      );

      // Restore the stubs
      unAssignManyDevicesFromCohort
        .CohortModel("sample_tenant")
        .findById.restore();
      createCohort.DeviceModel("sample_tenant").find.restore();
      unAssignManyDevicesFromCohort
        .DeviceModel("sample_tenant")
        .updateMany.restore();
    });

    // Add more test cases as needed for different scenarios
  });

  describe("assignOneDeviceToCohort", () => {
    it("should assign a device to a cohort successfully", async () => {
      // Arrange
      const request = {
        params: {
          cohort_id: "sample_cohort_id",
          device_id: "sample_device_id",
        },
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the DeviceModel.exists function to return true (device exists)
      const deviceExistsStub = chai.spy.on(
        createCohort.DeviceModel("sample_tenant"),
        "exists",
        () => true
      );

      // Mock the CohortModel.exists function to return true (cohort exists)
      const cohortExistsStub = chai.spy.on(
        createCohort.CohortModel("sample_tenant"),
        "exists",
        () => true
      );

      // Mock the DeviceModel.findById function to return a valid device
      const findByIdDeviceStub = chai.spy.on(
        createCohort.DeviceModel("sample_tenant"),
        "findById",
        () => ({
          _id: "sample_device_id",
          // Add any other device data here
        })
      );

      // Mock the DeviceModel.findByIdAndUpdate function to return the updated device
      const findByIdAndUpdateStub = chai.spy.on(
        createCohort.DeviceModel("sample_tenant"),
        "findByIdAndUpdate",
        () => ({
          _id: "sample_device_id",
          // Add any other updated device data here
        })
      );

      // Act
      const result = await createCohort.assignOneDeviceToCohort(request);

      // Assert
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Device assigned to the Cohort");
      expect(result.status).to.equal(httpStatus.OK);
      // Add additional assertions based on the response data

      // Restore the stubs
      createCohort.DeviceModel("sample_tenant").exists.restore();
      createCohort.CohortModel("sample_tenant").exists.restore();
      createCohort.DeviceModel("sample_tenant").findById.restore();
      assignOneDeviceToCohort
        .DeviceModel("sample_tenant")
        .findByIdAndUpdate.restore();
    });

    it("should handle non-existent device or cohort", async () => {
      // Arrange
      const request = {
        params: {
          cohort_id: "invalid_cohort_id",
          device_id: "invalid_device_id",
        },
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the DeviceModel.exists function to return false (device does not exist)
      const deviceExistsStub = chai.spy.on(
        createCohort.DeviceModel("sample_tenant"),
        "exists",
        () => false
      );

      // Mock the CohortModel.exists function to return true (cohort exists)
      const cohortExistsStub = chai.spy.on(
        createCohort.CohortModel("sample_tenant"),
        "exists",
        () => true
      );

      // Act
      const result = await createCohort.assignOneDeviceToCohort(request);

      // Assert
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Device or Cohort not found");
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.errors.message).to.equal(
        "Device invalid_device_id or Cohort invalid_cohort_id not found"
      );

      // Restore the stubs
      createCohort.DeviceModel("sample_tenant").exists.restore();
      createCohort.CohortModel("sample_tenant").exists.restore();
      createCohort.DeviceModel("sample_tenant").findById.restore();
      assignOneDeviceToCohort
        .DeviceModel("sample_tenant")
        .findByIdAndUpdate.restore();
    });

    it("should handle device already assigned to the cohort", async () => {
      // Arrange
      const request = {
        params: {
          cohort_id: "sample_cohort_id",
          device_id: "sample_device_id",
        },
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the DeviceModel.exists function to return true (device exists)
      const deviceExistsStub = chai.spy.on(
        createCohort.DeviceModel("sample_tenant"),
        "exists",
        () => true
      );

      // Mock the CohortModel.exists function to return true (cohort exists)
      const cohortExistsStub = chai.spy.on(
        createCohort.CohortModel("sample_tenant"),
        "exists",
        () => true
      );

      // Mock the DeviceModel.findById function to return a valid device
      const findByIdDeviceStub = chai.spy.on(
        createCohort.DeviceModel("sample_tenant"),
        "findById",
        () => ({
          _id: "sample_device_id",
          cohorts: ["sample_cohort_id"], // Device is already assigned to the cohort
          // Add any other device data here
        })
      );

      // Act
      const result = await createCohort.assignOneDeviceToCohort(request);

      // Assert
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Bad Request Error");
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.errors.message).to.equal(
        "Device already assigned to Cohort"
      );

      // Restore the stubs
      createCohort.DeviceModel("sample_tenant").exists.restore();
      createCohort.CohortModel("sample_tenant").exists.restore();
      createCohort.DeviceModel("sample_tenant").findById.restore();
      assignOneDeviceToCohort
        .DeviceModel("sample_tenant")
        .findByIdAndUpdate.restore();
    });

    // Add more test cases as needed for different scenarios
  });

  describe("unAssignOneDeviceFromCohort", () => {
    it("should unassign a device from a cohort successfully", async () => {
      // Arrange
      const request = {
        params: {
          cohort_id: "sample_cohort_id",
          device_id: "sample_device_id",
        },
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the CohortModel.findById function to return a valid cohort
      const findByIdCohortStub = chai.spy.on(
        createCohort.CohortModel("sample_tenant"),
        "findById",
        () => ({
          _id: "sample_cohort_id",
          // Add any other cohort data here
        })
      );

      // Mock the DeviceModel.findById function to return a valid device
      const findByIdDeviceStub = chai.spy.on(
        createCohort.DeviceModel("sample_tenant"),
        "findById",
        () => ({
          _id: "sample_device_id",
          cohorts: ["sample_cohort_id"], // Device is assigned to the cohort
          // Add any other device data here
        })
      );

      // Mock the DeviceModel.findByIdAndUpdate function to return the updated device
      const findByIdAndUpdateStub = chai.spy.on(
        createCohort.DeviceModel("sample_tenant"),
        "findByIdAndUpdate",
        () => ({
          _id: "sample_device_id",
          cohorts: [], // Device is no longer assigned to the cohort
          // Add any other updated device data here
        })
      );

      // Act
      const result = await createCohort.unAssignOneDeviceFromCohort(request);

      // Assert
      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "Successfully unassigned Device from the Cohort"
      );
      expect(result.status).to.equal(httpStatus.OK);
      // Add additional assertions based on the response data

      // Restore the stubs
      unAssignOneDeviceFromCohort
        .CohortModel("sample_tenant")
        .findById.restore();
      unAssignOneDeviceFromCohort
        .DeviceModel("sample_tenant")
        .findById.restore();
      unAssignOneDeviceFromCohort
        .DeviceModel("sample_tenant")
        .findByIdAndUpdate.restore();
    });

    it("should handle non-existent cohort or device", async () => {
      // Arrange
      const request = {
        params: {
          cohort_id: "invalid_cohort_id",
          device_id: "invalid_device_id",
        },
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the CohortModel.findById function to return null (cohort does not exist)
      const findByIdCohortStub = chai.spy.on(
        createCohort.CohortModel("sample_tenant"),
        "findById",
        () => null
      );

      // Mock the DeviceModel.findById function to return null (device does not exist)
      const findByIdDeviceStub = chai.spy.on(
        createCohort.DeviceModel("sample_tenant"),
        "findById",
        () => null
      );

      // Act
      const result = await createCohort.unAssignOneDeviceFromCohort(request);

      // Assert
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Bad Request Error");
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.errors.message).to.equal(
        "Invalid Request --- either Cohort invalid_cohort_id or Device invalid_device_id not found"
      );

      // Restore the stubs
      unAssignOneDeviceFromCohort
        .CohortModel("sample_tenant")
        .findById.restore();
      unAssignOneDeviceFromCohort
        .DeviceModel("sample_tenant")
        .findById.restore();
      unAssignOneDeviceFromCohort
        .DeviceModel("sample_tenant")
        .findByIdAndUpdate.restore();
    });

    it("should handle device not assigned to the cohort", async () => {
      // Arrange
      const request = {
        params: {
          cohort_id: "sample_cohort_id",
          device_id: "sample_device_id",
        },
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the CohortModel.findById function to return a valid cohort
      const findByIdCohortStub = chai.spy.on(
        createCohort.CohortModel("sample_tenant"),
        "findById",
        () => ({
          _id: "sample_cohort_id",
          // Add any other cohort data here
        })
      );

      // Mock the DeviceModel.findById function to return a valid device
      const findByIdDeviceStub = chai.spy.on(
        createCohort.DeviceModel("sample_tenant"),
        "findById",
        () => ({
          _id: "sample_device_id",
          cohorts: [], // Device is not assigned to the cohort
          // Add any other device data here
        })
      );

      // Act
      const result = await createCohort.unAssignOneDeviceFromCohort(request);

      // Assert
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Bad Request Error");
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.errors.message).to.equal(
        "Device sample_device_id is not assigned to Cohort sample_cohort_id"
      );

      // Restore the stubs
      unAssignOneDeviceFromCohort
        .CohortModel("sample_tenant")
        .findById.restore();
      unAssignOneDeviceFromCohort
        .DeviceModel("sample_tenant")
        .findById.restore();
      unAssignOneDeviceFromCohort
        .DeviceModel("sample_tenant")
        .findByIdAndUpdate.restore();
    });

    // Add more test cases as needed for different scenarios
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
