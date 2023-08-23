require("module-alias/register");
const httpStatus = require("http-status");
const chai = require("chai");
const sinon = require("sinon");
const createHealthTips = require("@utils/create-health-tips");
const { getModelByTenant } = require("@config/database");
const HealthTipSchema = require("@models/HealthTips");
const { expect } = chai;

describe("createHealthTips", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("list", () => {
    it("should list health tips successfully", async () => {
      // Arrange
      const requestMock = {
        query: { tenant: "testTenant" },
        query: { limit: 10, skip: 0 },
      };

      const generateFilterStub = sinon.stub().returns({});
      const getModelByTenantStub = sinon
        .stub()
        .returns({ list: sinon.stub().resolves({}) });

      // Replace the generateFilter and getModelByTenant methods in the createHealthTips object
      createHealthTips.list = createHealthTips.list.bind({
        generateFilter: generateFilterStub,
        getModelByTenant: getModelByTenantStub,
      });

      // Act
      const result = await createHealthTips.list(requestMock);

      // Assert
      expect(result).to.deep.equal({});
      expect(generateFilterStub.calledWithExactly(requestMock)).to.be.true;
      expect(
        getModelByTenantStub.calledWithExactly(
          "testTenant",
          "healthtip",
          HealthTipSchema
        )
      ).to.be.true;
    });

    // Add more tests for the list function if needed
  });

  describe("delete", () => {
    it("should delete health tip successfully", async () => {
      // Arrange
      const requestMock = {
        query: { tenant: "testTenant" },
        body: {
          /* Add your filter conditions here */
        },
      };

      const generateFilterStub = sinon.stub().returns({});
      const getModelByTenantStub = sinon
        .stub()
        .returns({ remove: sinon.stub().resolves({}) });

      // Replace the generateFilter and getModelByTenant methods in the createHealthTips object
      createHealthTips.delete = createHealthTips.delete.bind({
        generateFilter: generateFilterStub,
        getModelByTenant: getModelByTenantStub,
      });

      // Act
      const result = await createHealthTips.delete(requestMock);

      // Assert
      expect(result).to.deep.equal({});
      expect(generateFilterStub.calledWithExactly(requestMock)).to.be.true;
      expect(
        getModelByTenantStub.calledWithExactly(
          "testTenant",
          "healthtip",
          HealthTipSchema
        )
      ).to.be.true;
    });

    it("should handle internal server error", async () => {
      // Arrange
      const requestMock = {
        query: { tenant: "testTenant" },
        body: {
          /* Add your filter conditions here */
        },
      };

      const generateFilterStub = sinon.stub().returns({});
      const getModelByTenantStub = sinon
        .stub()
        .returns({ remove: sinon.stub().throws(new Error("Database error")) });

      // Replace the generateFilter and getModelByTenant methods in the createHealthTips object
      createHealthTips.delete = createHealthTips.delete.bind({
        generateFilter: generateFilterStub,
        getModelByTenant: getModelByTenantStub,
      });

      // Act
      const result = await createHealthTips.delete(requestMock);

      // Assert
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: "Database error" },
      });
      expect(generateFilterStub.calledWithExactly(requestMock)).to.be.true;
      expect(
        getModelByTenantStub.calledWithExactly(
          "testTenant",
          "healthtip",
          HealthTipSchema
        )
      ).to.be.true;
    });

    // Add more tests for the delete function if needed
  });

  describe("update", () => {
    it("should update health tip successfully", async () => {
      // Arrange
      const requestMock = {
        query: { tenant: "testTenant" },
        body: {
          /* Add your update data here */
        },
      };

      const generateFilterStub = sinon.stub().returns({});
      const getModelByTenantStub = sinon
        .stub()
        .returns({ modify: sinon.stub().resolves({}) });

      // Replace the generateFilter and getModelByTenant methods in the createHealthTips object
      createHealthTips.update = createHealthTips.update.bind({
        generateFilter: generateFilterStub,
        getModelByTenant: getModelByTenantStub,
      });

      // Act
      const result = await createHealthTips.update(requestMock);

      // Assert
      expect(result).to.deep.equal({});
      expect(generateFilterStub.calledWithExactly(requestMock)).to.be.true;
      expect(
        getModelByTenantStub.calledWithExactly(
          "testTenant",
          "healthtip",
          HealthTipSchema
        )
      ).to.be.true;
    });

    it("should handle internal server error", async () => {
      // Arrange
      const requestMock = {
        query: { tenant: "testTenant" },
        body: {
          /* Add your update data here */
        },
      };

      const generateFilterStub = sinon.stub().returns({});
      const getModelByTenantStub = sinon
        .stub()
        .returns({ modify: sinon.stub().throws(new Error("Database error")) });

      // Replace the generateFilter and getModelByTenant methods in the createHealthTips object
      createHealthTips.update = createHealthTips.update.bind({
        generateFilter: generateFilterStub,
        getModelByTenant: getModelByTenantStub,
      });

      // Act
      const result = await createHealthTips.update(requestMock);

      // Assert
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: "Database error" },
      });
      expect(generateFilterStub.calledWithExactly(requestMock)).to.be.true;
      expect(
        getModelByTenantStub.calledWithExactly(
          "testTenant",
          "healthtip",
          HealthTipSchema
        )
      ).to.be.true;
    });

    // Add more tests for the update function if needed
  });

  describe("create", () => {
    it("should create health tip successfully and send message to Kafka", async () => {
      // Arrange
      const requestMock = {
        query: { tenant: "testTenant" },
        body: {
          /* Add your health tip data here */
        },
      };

      const responseFromRegisterHealthTip = {
        success: true,
        data: {
          /* Add your response data here */
        },
      };

      const kafkaProducerStub = {
        connect: sinon.stub(),
        send: sinon.stub(),
        disconnect: sinon.stub(),
      };
      kafkaProducerStub.connect.resolves();
      kafkaProducerStub.send.resolves();
      kafkaProducerStub.disconnect.resolves();

      const getModelByTenantStub = sinon.stub().returns({
        register: sinon.stub().resolves(responseFromRegisterHealthTip),
      });

      const KafkaStub = sinon
        .stub(Kafka, "producer")
        .returns(kafkaProducerStub);

      // Replace the getModelByTenant and Kafka constructor in the createHealthTips object
      createHealthTips.create = createHealthTips.create.bind({
        getModelByTenant: getModelByTenantStub,
        Kafka,
        logObject,
        logger,
        constants,
      });

      // Act
      const result = await createHealthTips.create(requestMock);

      // Assert
      expect(result).to.deep.equal(responseFromRegisterHealthTip);
      expect(
        getModelByTenantStub.calledWithExactly(
          "testTenant",
          "healthtip",
          HealthTipSchema
        )
      ).to.be.true;
      expect(
        KafkaStub.calledWithExactly({
          clientId: constants.KAFKA_CLIENT_ID,
          brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
        })
      ).to.be.true;
      expect(kafkaProducerStub.connect.calledOnce).to.be.true;
      expect(
        kafkaProducerStub.send.calledWithExactly({
          topic: constants.TIPS_TOPIC,
          messages: [
            {
              action: "create",
              value: JSON.stringify(responseFromRegisterHealthTip.data),
            },
          ],
        })
      ).to.be.true;
      expect(kafkaProducerStub.disconnect.calledOnce).to.be.true;
    });

    it("should handle internal server error during Kafka message sending", async () => {
      // Arrange
      const requestMock = {
        query: { tenant: "testTenant" },
        body: {
          /* Add your health tip data here */
        },
      };

      const responseFromRegisterHealthTip = {
        success: true,
        data: {
          /* Add your response data here */
        },
      };

      const kafkaProducerStub = {
        connect: sinon.stub(),
        send: sinon.stub(),
        disconnect: sinon.stub(),
      };
      kafkaProducerStub.connect.resolves();
      kafkaProducerStub.send.rejects(new Error("Kafka error"));
      kafkaProducerStub.disconnect.resolves();

      const getModelByTenantStub = sinon.stub().returns({
        register: sinon.stub().resolves(responseFromRegisterHealthTip),
      });

      const KafkaStub = sinon
        .stub(Kafka, "producer")
        .returns(kafkaProducerStub);

      // Replace the getModelByTenant and Kafka constructor in the createHealthTips object
      createHealthTips.create = createHealthTips.create.bind({
        getModelByTenant: getModelByTenantStub,
        Kafka,
        logObject,
        logger,
        constants,
      });

      // Act
      const result = await createHealthTips.create(requestMock);

      // Assert
      expect(result).to.deep.equal(responseFromRegisterHealthTip);
      expect(
        getModelByTenantStub.calledWithExactly(
          "testTenant",
          "healthtip",
          HealthTipSchema
        )
      ).to.be.true;
      expect(
        KafkaStub.calledWithExactly({
          clientId: constants.KAFKA_CLIENT_ID,
          brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
        })
      ).to.be.true;
      expect(kafkaProducerStub.connect.calledOnce).to.be.true;
      expect(
        kafkaProducerStub.send.calledWithExactly({
          topic: constants.TIPS_TOPIC,
          messages: [
            {
              action: "create",
              value: JSON.stringify(responseFromRegisterHealthTip.data),
            },
          ],
        })
      ).to.be.true;
      expect(logger.error.calledOnce).to.be.true;
      expect(kafkaProducerStub.disconnect.calledOnce).to.be.true;
    });

    it("should handle internal server error during registration", async () => {
      // Arrange
      const requestMock = {
        query: { tenant: "testTenant" },
        body: {
          /* Add your health tip data here */
        },
      };

      const error = new Error("Database error");
      const getModelByTenantStub = sinon
        .stub()
        .returns({ register: sinon.stub().throws(error) });

      // Replace the getModelByTenant and Kafka constructor in the createHealthTips object
      createHealthTips.create = createHealthTips.create.bind({
        getModelByTenant: getModelByTenantStub,
        Kafka,
        logObject,
        logger,
        constants,
      });

      // Act
      const result = await createHealthTips.create(requestMock);

      // Assert
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      });
      expect(
        getModelByTenantStub.calledWithExactly(
          "testTenant",
          "healthtip",
          HealthTipSchema
        )
      ).to.be.true;
      expect(Kafka.producer.notCalled).to.be.true;
    });

    // Add more tests for the create function if needed
  });
});
