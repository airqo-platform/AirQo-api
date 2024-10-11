require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const mongoose = require("mongoose");
const SubscriptionModel = require("@models/Subscription");
const { HttpError } = require("@utils/errors");

describe("Subscription Model", () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("SubscriptionSchema", () => {
    it("should define the schema correctly", () => {
      const schema = SubscriptionSchema;
      expect(schema.paths).to.exist;
      expect(schema.paths.email).to.exist;
      expect(schema.paths.name).to.exist;
      expect(schema.paths.status).to.exist;
      expect(schema.paths.subscriptionType).to.exist;
      expect(schema.paths.topics).to.exist;
      expect(schema.paths.lastEmailSent).to.exist;
      expect(schema.paths.source).to.exist;
      expect(schema.paths.ipAddress).to.exist;
      expect(schema.paths.userAgent).to.exist;
      expect(schema.options.timestamps).to.exist;
    });

    it("should validate required fields", () => {
      const validSubscription = {
        email: "test@example.com",
        name: "Test Name",
        status: "active",
        subscriptionType: "weekly",
        topics: ["topic1", "topic2"],
        source: "sourceValue",
      };

      const invalidSubscription = {};

      expect(SubscriptionSchema.validate(validSubscription)).to.not.throw();
      expect(() => SubscriptionSchema.validate(invalidSubscription)).to.throw(
        /Email is required/
      );
      expect(() => SubscriptionSchema.validate(invalidSubscription)).to.throw(
        /Name is required/
      );
      expect(() => SubscriptionSchema.validate(invalidSubscription)).to.throw(
        /Status is required/
      );
      expect(() => SubscriptionSchema.validate(invalidSubscription)).to.throw(
        /Subscription Type is required/
      );
      expect(() => SubscriptionSchema.validate(invalidSubscription)).to.throw(
        /Topics is required/
      );
      expect(() => SubscriptionSchema.validate(invalidSubscription)).to.throw(
        /Source is required/
      );
    });

    it("should validate unique emails", async () => {
      const validSubscription = {
        email: "unique@email.com",
        name: "Test Name",
      };

      const duplicateSubscription = {
        email: "unique@email.com",
        name: "Duplicate Name",
      };

      const db = await mongoose.connect("mongodb://localhost/test-db");
      const Subscription = mongoose.model("subscriptions", SubscriptionSchema);

      await Subscription.create(validSubscription);

      await expect(
        SubscriptionSchema.validate(duplicateSubscription)
      ).to.be.rejectedWith("Email should be unique!");
    });

    it("should validate email format", async () => {
      const validEmail = "test@example.com";
      const invalidEmails = ["invalid-email", "email@", "@example.com"];

      const db = await mongoose.connect("mongodb://localhost/test-db");
      const Subscription = mongoose.model("subscriptions", SubscriptionSchema);

      await Subscription.create({ email: validEmail });

      await Promise.all(
        invalidEmails.map((email) =>
          expect(SubscriptionSchema.validate({ email })).to.be.rejectedWith(
            "Invalid email address"
          )
        )
      );
    });

    it("should validate name length", async () => {
      const validName = "Valid Name";
      const longName = "a".repeat(101); // 101 characters
      const shortName = "a".repeat(99); // 99 characters

      const db = await mongoose.connect("mongodb://localhost/test-db");
      const Subscription = mongoose.model("subscriptions", SubscriptionSchema);

      await Subscription.create({ email: "test@example.com", name: validName });

      await expect(
        SubscriptionSchema.validate({ name: longName })
      ).to.be.rejectedWith("Name cannot be more than 100 characters");

      await expect(
        SubscriptionSchema.validate({ name: shortName })
      ).to.not.throw();
    });
  });

  describe("SubscriptionSchema methods", () => {
    it("should export toJSON method", () => {
      const subscription = new SubscriptionModel()
        .schema({
          _id: "123",
          email: "test@example.com",
          name: "Test Name",
          status: "active",
          subscriptionType: "weekly",
          topics: ["topic1", "topic2"],
          lastEmailSent: new Date(),
          source: "sourceValue",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .toObject();

      const jsonResult = subscription.toJSON();
      expect(jsonResult).to.deep.equal({
        _id: "123",
        email: "test@example.com",
        name: "Test Name",
        status: "active",
        subscriptionType: "weekly",
        topics: ["topic1", "topic2"],
        lastEmailSent: expect.any(Date),
        source: "sourceValue",
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });

  describe("static methods", () => {
    let mockMongooseModel;

    beforeEach(() => {
      mockMongooseModel = sinon.mock(mongoose.Model);
    });

    afterEach(() => {
      mockMongooseModel.restore();
    });

    describe("create method", () => {
      it("should create a new subscription", async () => {
        const mockCreate = sandbox
          .stub(mongoose.Model.prototype.create, "exec")
          .resolves({ _id: "123", email: "test@example.com" });

        const result = await SubscriptionModel.create(
          { email: "test@example.com", name: "Test Name" },
          {}
        );

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.message).to.equal("Subscription created successfully");
        expect(result.status).to.equal(httpStatus.CREATED);
        expect(mockCreate).to.have.been.calledOnceWith({
          email: "test@example.com",
          name: "Test Name",
        });
      });

      it("should fail to create when required fields are missing", async () => {
        const mockCreate = sandbox
          .stub(mongoose.Model.prototype.create, "exec")
          .resolves(null);

        const result = await SubscriptionModel.create({}, {});

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Failed to create subscription");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
        expect(mockCreate).to.have.been.calledOnceWith({});
      });
    });

    describe("list method", () => {
      it("should list subscriptions", async () => {
        const mockFind = sandbox
          .stub(mongoose.Model.prototype.find, "exec")
          .resolves([
            {
              _id: "1",
              email: "test1@example.com",
              name: "Test 1",
              status: "active",
            },
            {
              _id: "2",
              email: "test2@example.com",
              name: "Test 2",
              status: "unsubscribed",
            },
          ]);
        const mockCountDocuments = sandbox
          .stub(mongoose.Model.prototype.countDocuments, "exec")
          .resolves(2);

        const result = await SubscriptionModel.list({}, {});

        expect(result.success).to.be.true;
        expect(result.data).to.have.lengthOf(2);
        expect(result.total).to.equal(2);
        expect(result.message).to.equal("Successfully retrieved subscriptions");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFind).to.have.been.calledOnceWith({});
        expect(mockCountDocuments).to.have.been.calledOnceWith({});
      });

      it("should handle empty results", async () => {
        const mockFind = sandbox
          .stub(mongoose.Model.prototype.find, "exec")
          .resolves([]);
        const mockCountDocuments = sandbox
          .stub(mongoose.Model.prototype.countDocuments, "exec")
          .resolves(0);

        const result = await SubscriptionModel.list({}, {});

        expect(result.success).to.be.true;
        expect(result.data).to.deep.equal([]);
        expect(result.total).to.equal(0);
        expect(result.message).to.equal("No subscriptions found");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFind).to.have.been.calledOnceWith({});
        expect(mockCountDocuments).to.have.been.calledOnceWith({});
      });
    });

    describe("findById method", () => {
      it("should find a subscription by ID", async () => {
        const mockFindOne = sandbox
          .stub(mongoose.Model.prototype.findOne, "exec")
          .resolves({
            _id: "123",
            email: "test@example.com",
            name: "Test Name",
            status: "active",
          });

        const result = await SubscriptionModel.findById("123", {});

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.message).to.equal("Successfully retrieved subscription");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFindOne).to.have.been.calledOnceWith({ _id: "123" });
      });

      it("should return not found when subscription does not exist", async () => {
        const mockFindOne = sandbox
          .stub(mongoose.Model.prototype.findOne, "exec")
          .resolves(null);

        const result = await SubscriptionModel.findById("nonexistent-id", {});

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Subscription not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockFindOne).to.have.been.calledOnceWith({
          _id: "nonexistent-id",
        });
      });
    });

    describe("update method", () => {
      it("should update a subscription", async () => {
        const mockUpdateOne = sandbox
          .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
          .resolves({
            _id: "123",
            email: "updated@example.com",
            name: "Updated Name",
            status: "active",
          });

        const result = await SubscriptionModel.update(
          {
            id: "123",
            update: { email: "updated@example.com", name: "Updated Name" },
          },
          {}
        );

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.message).to.equal(
          "Successfully updated the subscription"
        );
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockUpdateOne).to.have.been.calledOnceWith(
          "123",
          { email: "updated@example.com", name: "Updated Name" },
          { new: true, runValidators: true }
        );
      });

      it("should return not found when subscription does not exist", async () => {
        const mockUpdateOne = sandbox
          .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
          .resolves(null);

        const result = await SubscriptionModel.update(
          { id: "nonexistent-id", update: {} },
          {}
        );

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Subscription not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockUpdateOne).to.have.been.calledOnceWith(
          "nonexistent-id",
          {},
          { new: true, runValidators: true }
        );
      });
    });

    describe("remove method", () => {
      it("should remove a subscription", async () => {
        const mockRemove = sandbox
          .stub(mongoose.Model.prototype.findByIdAndRemove, "exec")
          .resolves({
            _id: "123",
            email: "test@example.com",
            name: "Test Name",
            status: "active",
          });

        const result = await SubscriptionModel.remove("123", {});

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.message).to.equal(
          "Successfully removed the subscription"
        );
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockRemove).to.have.been.calledOnceWith("123");
      });

      it("should return not found when subscription does not exist", async () => {
        const mockRemove = sandbox
          .stub(mongoose.Model.prototype.findByIdAndRemove, "exec")
          .resolves(null);

        const result = await SubscriptionModel.remove("nonexistent-id", {});

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Subscription not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockRemove).to.have.been.calledOnceWith("nonexistent-id");
      });
    });

    describe("findByEmail method", () => {
      it("should find a subscription by email", async () => {
        const mockFindOne = sandbox
          .stub(mongoose.Model.prototype.findOne, "exec")
          .resolves({
            _id: "123",
            email: "test@example.com",
            name: "Test Name",
            status: "active",
          });

        const result = await SubscriptionModel.findByEmail(
          "test@example.com",
          {}
        );

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.message).to.equal("Successfully retrieved subscription");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFindOne).to.have.been.calledOnceWith({
          email: "test@example.com",
        });
      });

      it("should return not found when subscription does not exist", async () => {
        const mockFindOne = sandbox
          .stub(mongoose.Model.prototype.findOne, "exec")
          .resolves(null);

        const result = await SubscriptionModel.findByEmail(
          "nonexistent@example.com",
          {}
        );

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Subscription not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockFindOne).to.have.been.calledOnceWith({
          email: "nonexistent@example.com",
        });
      });
    });

    describe("getSubscriptionStats method", () => {
      it("should calculate subscription statistics", async () => {
        const mockAggregate = sandbox
          .stub(mongoose.Model.prototype.aggregate, "exec")
          .resolves([
            {
              _id: "active",
              count: 10,
            },
            {
              _id: "unsubscribed",
              count: 5,
            },
            {
              _id: null,
              total: 15,
              statuses: [
                { status: "active", count: 10 },
                { status: "unsubscribed", count: 5 },
              ],
            },
          ]);

        const result = await SubscriptionModel.getSubscriptionStats({});

        expect(result.success).to.be.true;
        expect(result.data).to.deep.equal({
          total: 15,
          statuses: [
            { status: "active", count: 10 },
            { status: "unsubscribed", count: 5 },
          ],
        });
        expect(result.message).to.equal(
          "Successfully retrieved subscription stats"
        );
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockAggregate).to.have.been.calledOnceWith([
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$count" },
              statuses: { $push: { status: "$_id", count: "$count" } },
            },
          },
          {
            $project: {
              _id: 0,
              total: 1,
              statuses: 1,
            },
          },
        ]);
      });

      it("should handle errors during aggregation", async () => {
        const mockAggregate = sandbox
          .stub(mongoose.Model.prototype.aggregate, "exec")
          .rejects(new Error("Aggregation failed"));

        const result = await SubscriptionModel.getSubscriptionStats({});

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Internal Server Error");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
        expect(mockAggregate).to.have.been.calledOnceWith([
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$count" },
              statuses: { $push: { status: "$_id", count: "$count" } },
            },
          },
          {
            $project: {
              _id: 0,
              total: 1,
              statuses: 1,
            },
          },
        ]);
      });
    });
  });
});
