require("module-alias/register");
const chai = require("chai");
const { expect } = chai;
const sinon = require("sinon");
const httpStatus = require("http-status");
const createNetwork = require("@utils/create-network");
const UserModel = require("@models/User");
const NetworkModel = require("@models/Network");
const chaiHttp = require("chai-http");
chai.use(chaiHttp);

describe("createNetwork", () => {
  describe("getNetworkFromEmail method", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should retrieve the network from email successfully", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
      };
      const responseFromExtractOneNetwork = {
        success: true,
        data: "sample_network",
      };
      const responseFromGenerateFilter = {
        success: true,
        data: { net_acronym: "sample_network" },
      };
      const responseFromListNetworks = {
        success: true,
        data: [
          {
            net_name: "Sample Network",
            net_acronym: "sample_network",
          },
        ],
        message: "successfully retrieved the network",
        status: 200,
      };

      // Stub the extractOneAcronym method to return success response
      sinon
        .stub(createNetwork, "extractOneAcronym")
        .resolves(responseFromExtractOneNetwork);

      // Stub the generateFilter.networks method to return success response
      sinon
        .stub(generateFilter, "networks")
        .resolves(responseFromGenerateFilter);

      // Stub the NetworkModel.list method to return success response
      sinon.stub(createNetwork, "NetworkModel").returns({
        list: sinon.stub().resolves(responseFromListNetworks),
      });

      // Call the getNetworkFromEmail method
      const response = await createNetwork.getNetworkFromEmail(request);

      // Verify the response
      expect(response).to.deep.equal({
        success: true,
        data: "Sample Network",
        message: "successfully retrieved the network",
        status: 200,
      });
    });

    it("should handle errors and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
      };
      const responseFromExtractOneNetwork = {
        success: false,
        message: "Invalid email",
      };

      // Stub the extractOneAcronym method to return failure response
      sinon
        .stub(createNetwork, "extractOneAcronym")
        .resolves(responseFromExtractOneNetwork);

      // Call the getNetworkFromEmail method
      const response = await createNetwork.getNetworkFromEmail(request);

      // Verify the response
      expect(response).to.deep.equal({
        success: false,
        message: "Invalid email",
      });
    });

    it("should handle generateFilter.networks failure and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
      };
      const responseFromExtractOneNetwork = {
        success: true,
        data: "sample_network",
      };
      const responseFromGenerateFilter = {
        success: false,
        message: "Invalid filter",
      };

      // Stub the extractOneAcronym method to return success response
      sinon
        .stub(createNetwork, "extractOneAcronym")
        .resolves(responseFromExtractOneNetwork);

      // Stub the generateFilter.networks method to return failure response
      sinon
        .stub(generateFilter, "networks")
        .resolves(responseFromGenerateFilter);

      // Call the getNetworkFromEmail method
      const response = await createNetwork.getNetworkFromEmail(request);

      // Verify the response
      expect(response).to.deep.equal({
        success: false,
        message: "Invalid filter",
      });
    });

    it("should handle NetworkModel.list failure and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
      };
      const responseFromExtractOneNetwork = {
        success: true,
        data: "sample_network",
      };
      const responseFromGenerateFilter = {
        success: true,
        data: { net_acronym: "sample_network" },
      };
      const responseFromListNetworks = {
        success: false,
        message: "Error retrieving the network",
      };

      // Stub the extractOneAcronym method to return success response
      sinon
        .stub(createNetwork, "extractOneAcronym")
        .resolves(responseFromExtractOneNetwork);

      // Stub the generateFilter.networks method to return success response
      sinon
        .stub(generateFilter, "networks")
        .resolves(responseFromGenerateFilter);

      // Stub the NetworkModel.list method to return failure response
      sinon.stub(createNetwork, "NetworkModel").returns({
        list: sinon.stub().resolves(responseFromListNetworks),
      });

      // Call the getNetworkFromEmail method
      const response = await createNetwork.getNetworkFromEmail(request);

      // Verify the response
      expect(response).to.deep.equal({
        success: false,
        message: "Error retrieving the network",
      });
    });

    it("should handle internal server error and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
      };

      // Stub the extractOneAcronym method to throw an error
      sinon
        .stub(createNetwork, "extractOneAcronym")
        .throws(new Error("Internal Server Error"));

      // Call the getNetworkFromEmail method
      const response = await createNetwork.getNetworkFromEmail(request);

      // Verify the response
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal Server Error" },
      });
    });
  });
  describe("extractOneAcronym method", () => {
    it("should extract the network acronym from a valid company email", () => {
      const request = {
        body: {
          net_email: "user@sample_company.com",
        },
      };

      // Call the extractOneAcronym method
      const response = createNetwork.extractOneAcronym(request);

      // Verify the response
      expect(response).to.deep.equal({
        success: true,
        data: "sample_company",
        status: 200,
        message: "successfully removed the file extension",
      });
    });

    it("should handle invalid company email and return failure response", () => {
      const request = {
        body: {
          net_email: "user@example.com",
        },
      };

      // Call the extractOneAcronym method
      const response = createNetwork.extractOneAcronym(request);

      // Verify the response
      expect(response).to.deep.equal({
        success: false,
        message: "Bad Request Error",
        errors: {
          message: "You need a company email for this operation",
        },
        status: 400,
      });
    });

    it("should handle internal server error and return failure response", () => {
      const request = {
        body: {
          net_email: "user@sample_company.com",
        },
      };

      // Stub the companyEmailValidator.isCompanyEmail method to throw an error
      sinon
        .stub(companyEmailValidator, "isCompanyEmail")
        .throws(new Error("Internal Server Error"));

      // Call the extractOneAcronym method
      const response = createNetwork.extractOneAcronym(request);

      // Verify the response
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        status: 500,
        errors: {
          message: "Internal Server Error",
        },
      });
    });
  });
  describe("sanitizeName method", () => {
    it("should sanitize a name with white spaces and return the trimmed and lowercase version", () => {
      const name = "  Sample Network  ";

      // Call the sanitizeName method
      const sanitizedName = createNetwork.sanitizeName(name);

      // Verify the response
      expect(sanitizedName).to.equal("samplenetwork");
    });

    it("should handle empty name and return an empty string", () => {
      const name = "";

      // Call the sanitizeName method
      const sanitizedName = createNetwork.sanitizeName(name);

      // Verify the response
      expect(sanitizedName).to.equal("");
    });

    it("should handle internal server error and log the error", () => {
      const name = "Sample Network";

      // Stub the replace method to throw an error
      sinon
        .stub(String.prototype, "replace")
        .throws(new Error("Internal Server Error"));

      // Stub the logger.error method to track if it was called
      const loggerStub = sinon.stub(logger, "error");

      // Call the sanitizeName method
      const sanitizedName = createNetwork.sanitizeName(name);

      // Verify the response
      expect(sanitizedName).to.be.undefined;
      expect(loggerStub.calledOnce).to.be.true;

      // Restore the stubbed methods to their original behavior
      String.prototype.replace.restore();
      logger.error.restore();
    });
  });
  describe("create method", () => {
    const request = {
      body: {
        net_email: "test@example.com",
        net_website: "example.com",
        /* other properties required by the create method */
      },
      query: {
        tenant: "sampleTenant",
      },
      user: {
        _id: "user123",
        email: "user@example.com",
        firstName: "John",
        lastName: "Doe",
      },
    };

    const networkModelMock = {
      findOne: sinon.stub().returns({}),
      register: sinon.stub().returns({
        success: true,
        data: {
          _doc: {
            _id: "net123",
          },
        },
      }),
    };

    const permissionModelMock = {
      find: sinon.stub(),
      insertMany: sinon.stub(),
    };

    const userModelMock = {
      findByIdAndUpdate: sinon.stub().returns({
        _id: "user123",
      }),
    };

    beforeEach(() => {
      sinon.resetHistory();
    });

    it("should create a new network with correct data and assign super admin role and permissions to the creator user", async () => {
      // Stub the extractOneAcronym method to return a valid network acronym
      sinon.stub(createNetwork, "extractOneAcronym").returns({
        success: true,
        data: "acronym",
      });

      // Stub the NetworkModel to return an empty result (no network with the given website exists)
      sinon.stub(mongoose, "model").returns(networkModelMock);

      // Stub the PermissionModel to return existing permissions and insert new permissions
      permissionModelMock.find
        .withArgs({
          permission: sinon.match.any,
        })
        .returns(permissionModelMock);
      permissionModelMock.distinct
        .withArgs("permission")
        .returns(["PERMISSION_1"]);

      // Stub the UserModel to return the updated user data
      sinon.stub(mongoose, "model").returns(userModelMock);

      // Call the create method
      const callback = sinon.stub();
      await createNetwork.create(request, callback);

      // Verify the response
      expect(callback.calledOnce).to.be.true;
      expect(
        callback.calledWithExactly({
          success: true,
          message: "network successfully created",
          data: {
            _id: "net123",
          },
          status: httpStatus.OK,
        })
      ).to.be.true;

      // Verify the correct methods were called
      expect(createNetwork.extractOneAcronym.calledOnce).to.be.true;
      expect(networkModelMock.register.calledOnce).to.be.true;
      expect(
        networkModelMock.register.calledWithExactly({
          net_email: "test@example.com",
          net_website: "example.com",
          net_name: "acronym",
          net_acronym: "acronym",
          net_manager: ObjectId("user123"),
          net_manager_username: "user@example.com",
          net_manager_firstname: "John",
          net_manager_lastname: "Doe",
        })
      ).to.be.true;
      expect(userModelMock.findByIdAndUpdate.calledOnce).to.be.true;
      expect(
        userModelMock.findByIdAndUpdate.calledWithExactly(
          "user123",
          {
            $addToSet: {
              networks: "net123",
            },
            role: sinon.match.any,
          },
          {
            new: true,
          }
        )
      ).to.be.true;

      // Restore the stubbed methods to their original behavior
      createNetwork.extractOneAcronym.restore();
      mongoose.model.restore();
    });

    it("should handle case when network with the given website already exists", async () => {
      // Stub the extractOneAcronym method to return a valid network acronym
      sinon.stub(createNetwork, "extractOneAcronym").returns({
        success: true,
        data: "acronym",
      });

      // Stub the NetworkModel to return an existing network with the given website
      sinon.stub(mongoose, "model").returns(networkModelMock);
      networkModelMock.findOne.returns({
        _id: "existingNet123",
        net_website: "example.com",
      });

      // Call the create method
      const callback = sinon.stub();
      await createNetwork.create(request, callback);

      // Verify the response
      expect(callback.calledOnce).to.be.true;
      expect(
        callback.calledWithExactly({
          success: false,
          message: "Bad Request Error",
          errors: {
            message: "Network for example.com already exists",
          },
          status: httpStatus.BAD_REQUEST,
        })
      ).to.be.true;

      // Verify the correct methods were called
      expect(createNetwork.extractOneAcronym.calledOnce).to.be.true;
      expect(networkModelMock.findOne.calledOnce).to.be.true;
      expect(networkModelMock.register.notCalled).to.be.true;
      expect(userModelMock.findByIdAndUpdate.notCalled).to.be.true;

      // Restore the stubbed methods to their original behavior
      createNetwork.extractOneAcronym.restore();
      mongoose.model.restore();
    });

    it("should handle case when user details are not provided", async () => {
      // Stub the extractOneAcronym method to return a valid network acronym
      sinon.stub(createNetwork, "extractOneAcronym").returns({
        success: true,
        data: "acronym",
      });

      // Stub the NetworkModel to return an empty result (no network with the given website exists)
      sinon.stub(mongoose, "model").returns(networkModelMock);

      // Call the create method with no user details
      const requestWithoutUser = {
        ...request,
        user: null,
      };
      const callback = sinon.stub();
      await createNetwork.create(requestWithoutUser, callback);

      // Verify the response
      expect(callback.calledOnce).to.be.true;
      expect(
        callback.calledWithExactly({
          success: false,
          message: "Bad Request Error",
          errors: {
            message: "creator's details are not provided",
          },
          status: httpStatus.BAD_REQUEST,
        })
      ).to.be.true;

      // Verify the correct methods were called
      expect(createNetwork.extractOneAcronym.calledOnce).to.be.true;
      expect(networkModelMock.register.notCalled).to.be.true;
      expect(userModelMock.findByIdAndUpdate.notCalled).to.be.true;

      // Restore the stubbed methods to their original behavior
      createNetwork.extractOneAcronym.restore();
      mongoose.model.restore();
    });

    it("should handle internal server error and return appropriate response", async () => {
      // Stub the extractOneAcronym method to throw an error
      sinon
        .stub(createNetwork, "extractOneAcronym")
        .throws(new Error("Internal Server Error"));

      // Call the create method
      const callback = sinon.stub();
      await createNetwork.create(request, callback);

      // Verify the response
      expect(callback.calledOnce).to.be.true;
      expect(
        callback.calledWithExactly({
          success: false,
          message: "network util server errors",
          errors: {
            message: "Internal Server Error",
          },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        })
      ).to.be.true;

      // Verify the correct methods were called
      expect(createNetwork.extractOneAcronym.calledOnce).to.be.true;
      expect(networkModelMock.register.notCalled).to.be.true;
      expect(userModelMock.findByIdAndUpdate.notCalled).to.be.true;

      // Restore the stubbed methods to their original behavior
      createNetwork.extractOneAcronym.restore();
      mongoose.model.restore();
    });
  });
  describe("assignUsers", () => {
    let sandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should assign users to a network successfully", async () => {
      // Define your mock request object
      const request = {
        params: {
          net_id: "network-id",
        },
        body: {
          user_ids: ["user-id-1", "user-id-2"],
        },
        query: {
          tenant: "test-tenant",
        },
      };

      // Stub the NetworkModel functions
      sandbox.stub(NetworkModel("test-tenant"), "findById").resolves({
        // Define the expected network object here
      });

      // Stub the UserModel functions
      sandbox.stub(UserModel("test-tenant"), "findById").resolves({
        _id: "user-id",
        // Other user properties
      });

      // Stub the bulkWrite function to simulate database updates
      sandbox.stub(UserModel("test-tenant"), "bulkWrite").resolves({
        nModified: 2, // Number of modified documents
        n: 2, // Total number of documents
      });

      // Make the request to your function
      const response = await createNetwork.assignUsers(request);

      // Assertions
      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal(
        "Successfully assigned all the provided users to the Network"
      );
      expect(response.data).to.be.an("array");
      // Add more assertions based on the expected response
    });

    // Add more test cases for error scenarios, validation, etc.
  });
  describe("assignOneUser", () => {
    let sandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should assign one user to a network successfully", async () => {
      // Define your mock request object
      const request = {
        params: {
          net_id: "network-id",
          user_id: "user-id",
        },
        query: {
          tenant: "test-tenant",
        },
      };

      // Stub the UserModel functions
      sandbox.stub(UserModel("test-tenant"), "exists").resolves(true);
      sandbox.stub(UserModel("test-tenant"), "findById").resolves({
        _id: "user-id",
        network_roles: [], // Simulate no network assignment initially
        // Other user properties
      });

      // Stub the NetworkModel functions
      sandbox.stub(NetworkModel("test-tenant"), "exists").resolves(true);

      // Stub the findByIdAndUpdate function to simulate database update
      sandbox.stub(UserModel("test-tenant"), "findByIdAndUpdate").resolves({
        _id: "user-id",
        network_roles: [{ network: "network-id" }], // Simulate the assignment
        // Other updated user properties
      });

      // Make the request to your function
      const response = await createNetwork.assignOneUser(request);

      // Assertions
      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal("User assigned to the Network");
      expect(response.data).to.be.an("object");
      // Add more assertions based on the expected response
    });

    // Add more test cases for error scenarios, validation, etc.
  });
  describe("unAssignUser", () => {
    let sandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should unassign a user from a network successfully", async () => {
      // Define your mock request object
      const request = {
        params: {
          net_id: "network-id",
          user_id: "user-id",
        },
        query: {
          tenant: "test-tenant",
        },
      };

      // Stub the NetworkModel functions
      sandbox.stub(NetworkModel("test-tenant"), "findById").resolves({
        _id: "network-id",
        // Other network properties
      });

      // Stub the UserModel functions
      sandbox.stub(UserModel("test-tenant"), "findById").resolves({
        _id: "user-id",
        network_roles: [{ network: "network-id" }], // Simulate the assignment
        // Other user properties
      });

      // Stub the findByIdAndUpdate function to simulate database update
      sandbox.stub(UserModel("test-tenant"), "findByIdAndUpdate").resolves({
        _id: "user-id",
        network_roles: [], // Simulate the unassignment
        // Other updated user properties
      });

      // Make the request to your function
      const response = await createNetwork.unAssignUser(request);

      // Assertions
      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal(
        "Successfully unassigned User from the Network"
      );
      expect(response.data).to.be.an("object");
      // Add more assertions based on the expected response
    });

    // Add more test cases for error scenarios, validation, etc.
  });
  describe("unAssignManyUsers", () => {
    let sandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should unassign multiple users from a network successfully", async () => {
      // Define your mock request object
      const request = {
        body: {
          user_ids: ["user-id-1", "user-id-2"],
        },
        params: {
          net_id: "network-id",
        },
        query: {
          tenant: "test-tenant",
        },
      };

      // Stub the NetworkModel functions
      sandbox.stub(NetworkModel("test-tenant"), "findById").resolves({
        _id: "network-id",
        // Other network properties
      });

      // Stub the UserModel functions
      sandbox.stub(UserModel("test-tenant"), "find").resolves([
        {
          _id: "user-id-1",
          network_roles: [{ network: "network-id" }], // Simulate the assignment
          // Other user properties
        },
        {
          _id: "user-id-2",
          network_roles: [{ network: "network-id" }], // Simulate the assignment
          // Other user properties
        },
      ]);

      // Stub the updateMany function to simulate database update
      sandbox.stub(UserModel("test-tenant"), "updateMany").resolves({
        nModified: 2,
      });

      // Make the request to your function
      const response = await createNetwork.unAssignManyUsers(request);

      // Assertions
      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal(
        "Successfully unassigned all the provided users from the network network-id"
      );
      expect(response.data).to.be.an("array");
      // Add more assertions based on the expected response
    });

    // Add more test cases for error scenarios, validation, etc.
  });
  describe("setManager", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should set a user as the network manager successfully", async () => {
      // Stub the UserModel.findById and NetworkModel.findById methods to return valid objects
      const userModelMock = {
        findById: sinon.stub().resolves({ _id: "user1", networks: ["net1"] }),
      };
      const networkModelMock = {
        findById: sinon
          .stub()
          .resolves({ _id: "net1", net_manager: "old_manager_id" }),
        findByIdAndUpdate: sinon
          .stub()
          .resolves({ _id: "net1", net_manager: "user1" }),
      };
      sinon.stub(createNetwork, "UserModel").returns(userModelMock);
      sinon.stub(createNetwork, "NetworkModel").returns(networkModelMock);

      const request = {
        params: {
          net_id: "net1",
          user_id: "user1",
        },
        query: {
          tenant: "example_tenant",
        },
      };

      // Call the setManager method
      const response = await createNetwork.setManager(request);

      // Verify the response
      expect(response.success).to.be.true;
      expect(response.message).to.equal(
        "User assigned to Network successfully"
      );
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.data._id).to.equal("net1");
      expect(response.data.net_manager).to.equal("user1");

      // Verify the correct methods were called
      expect(userModelMock.findById.calledOnce).to.be.true;
      expect(userModelMock.findById.calledWithExactly("user1")).to.be.true;
      expect(networkModelMock.findById.calledOnce).to.be.true;
      expect(networkModelMock.findById.calledWithExactly("net1")).to.be.true;
      expect(networkModelMock.findByIdAndUpdate.calledOnce).to.be.true;
      expect(
        networkModelMock.findByIdAndUpdate.calledWithExactly(
          "net1",
          { net_manager: "user1" },
          { new: true }
        )
      ).to.be.true;
    });

    it("should handle case when user is already the network manager", async () => {
      // Stub the UserModel.findById and NetworkModel.findById methods to return valid objects
      const userModelMock = {
        findById: sinon.stub().resolves({ _id: "user1", networks: ["net1"] }),
      };
      const networkModelMock = {
        findById: sinon.stub().resolves({ _id: "net1", net_manager: "user1" }),
      };
      sinon.stub(createNetwork, "UserModel").returns(userModelMock);
      sinon.stub(createNetwork, "NetworkModel").returns(networkModelMock);

      const request = {
        params: {
          net_id: "net1",
          user_id: "user1",
        },
        query: {
          tenant: "example_tenant",
        },
      };

      // Call the setManager method
      const response = await createNetwork.setManager(request);

      // Verify the response
      expect(response.success).to.be.false;
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal(
        "User user1 is already the network manager"
      );
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);

      // Verify the correct methods were called
      expect(userModelMock.findById.calledOnce).to.be.true;
      expect(userModelMock.findById.calledWithExactly("user1")).to.be.true;
      expect(networkModelMock.findById.calledOnce).to.be.true;
      expect(networkModelMock.findById.calledWithExactly("net1")).to.be.true;
      expect(createNetwork.NetworkModel.findByIdAndUpdate.notCalled).to.be.true;
    });

    it("should handle case when user is not part of the network's networks", async () => {
      // Stub the UserModel.findById and NetworkModel.findById methods to return valid objects
      const userModelMock = {
        findById: sinon.stub().resolves({ _id: "user1", networks: ["net2"] }),
      };
      const networkModelMock = {
        findById: sinon
          .stub()
          .resolves({ _id: "net1", net_manager: "old_manager_id" }),
      };
      sinon.stub(createNetwork, "UserModel").returns(userModelMock);
      sinon.stub(createNetwork, "NetworkModel").returns(networkModelMock);

      const request = {
        params: {
          net_id: "net1",
          user_id: "user1",
        },
        query: {
          tenant: "example_tenant",
        },
      };

      // Call the setManager method
      const response = await createNetwork.setManager(request);

      // Verify the response
      expect(response.success).to.be.false;
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal(
        "Network net1 is not part of User's networks, not authorized to manage this network"
      );
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);

      // Verify the correct methods were called
      expect(userModelMock.findById.calledOnce).to.be.true;
      expect(userModelMock.findById.calledWithExactly("user1")).to.be.true;
      expect(networkModelMock.findById.calledOnce).to.be.true;
      expect(networkModelMock.findById.calledWithExactly("net1")).to.be.true;
      expect(createNetwork.NetworkModel.findByIdAndUpdate.notCalled).to.be.true;
    });

    it("should handle case when user is not found", async () => {
      // Stub the UserModel.findById and NetworkModel.findById methods to return null objects
      const userModelMock = {
        findById: sinon.stub().resolves(null),
      };
      const networkModelMock = {
        findById: sinon
          .stub()
          .resolves({ _id: "net1", net_manager: "old_manager_id" }),
      };
      sinon.stub(createNetwork, "UserModel").returns(userModelMock);
      sinon.stub(createNetwork, "NetworkModel").returns(networkModelMock);

      const request = {
        params: {
          net_id: "net1",
          user_id: "user1",
        },
        query: {
          tenant: "example_tenant",
        },
      };

      // Call the setManager method
      const response = await createNetwork.setManager(request);

      // Verify the response
      expect(response.success).to.be.false;
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal("User not found");
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);

      // Verify the correct methods were called
      expect(userModelMock.findById.calledOnce).to.be.true;
      expect(userModelMock.findById.calledWithExactly("user1")).to.be.true;
      expect(createNetwork.NetworkModel.findById.notCalled).to.be.true;
      expect(createNetwork.NetworkModel.findByIdAndUpdate.notCalled).to.be.true;
    });

    it("should handle case when network is not found", async () => {
      // Stub the UserModel.findById and NetworkModel.findById methods to return valid user object and null network object
      const userModelMock = {
        findById: sinon.stub().resolves({ _id: "user1", networks: ["net1"] }),
      };
      const networkModelMock = {
        findById: sinon.stub().resolves(null),
      };
      sinon.stub(createNetwork, "UserModel").returns(userModelMock);
      sinon.stub(createNetwork, "NetworkModel").returns(networkModelMock);

      const request = {
        params: {
          net_id: "net1",
          user_id: "user1",
        },
        query: {
          tenant: "example_tenant",
        },
      };

      // Call the setManager method
      const response = await createNetwork.setManager(request);

      // Verify the response
      expect(response.success).to.be.false;
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal("Network not found");
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);

      // Verify the correct methods were called
      expect(userModelMock.findById.calledOnce).to.be.true;
      expect(userModelMock.findById.calledWithExactly("user1")).to.be.true;
      expect(networkModelMock.findById.calledOnce).to.be.true;
      expect(networkModelMock.findById.calledWithExactly("net1")).to.be.true;
      expect(createNetwork.NetworkModel.findByIdAndUpdate.notCalled).to.be.true;
    });

    it("should handle case when network record was not updated", async () => {
      // Stub the UserModel.findById and NetworkModel.findById methods to return valid objects
      const userModelMock = {
        findById: sinon.stub().resolves({ _id: "user1", networks: ["net1"] }),
      };
      const networkModelMock = {
        findById: sinon
          .stub()
          .resolves({ _id: "net1", net_manager: "old_manager_id" }),
        findByIdAndUpdate: sinon.stub().resolves(null),
      };
      sinon.stub(createNetwork, "UserModel").returns(userModelMock);
      sinon.stub(createNetwork, "NetworkModel").returns(networkModelMock);

      const request = {
        params: {
          net_id: "net1",
          user_id: "user1",
        },
        query: {
          tenant: "example_tenant",
        },
      };

      // Call the setManager method
      const response = await createNetwork.setManager(request);

      // Verify the response
      expect(response.success).to.be.false;
      expect(response.message).to.equal("Bad Request");
      expect(response.errors.message).to.equal("No network record was updated");
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);

      // Verify the correct methods were called
      expect(userModelMock.findById.calledOnce).to.be.true;
      expect(userModelMock.findById.calledWithExactly("user1")).to.be.true;
      expect(networkModelMock.findById.calledOnce).to.be.true;
      expect(networkModelMock.findById.calledWithExactly("net1")).to.be.true;
      expect(networkModelMock.findByIdAndUpdate.calledOnce).to.be.true;
      expect(
        networkModelMock.findByIdAndUpdate.calledWithExactly(
          "net1",
          { net_manager: "user1" },
          { new: true }
        )
      ).to.be.true;
    });

    // Add more test cases as needed for other scenarios
  });
  describe("update", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should update the network successfully", async () => {
      // Stub the NetworkModel.modify method to return a successful response
      const networkModelMock = {
        modify: sinon.stub().resolves({
          success: true,
          message: "Network updated successfully",
          status: httpStatus.OK,
          data: { _id: "net1", name: "New Network Name" },
        }),
      };
      sinon.stub(createNetwork, "NetworkModel").returns(networkModelMock);

      const request = {
        body: {
          name: "New Network Name",
        },
        query: {
          tenant: "example_tenant",
        },
        action: "update",
      };

      // Call the update method
      const response = await createNetwork.update(request);

      // Verify the response
      expect(response.success).to.be.true;
      expect(response.message).to.equal("Network updated successfully");
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.data._id).to.equal("net1");
      expect(response.data.name).to.equal("New Network Name");

      // Verify the correct methods were called
      expect(networkModelMock.modify.calledOnce).to.be.true;
      expect(
        networkModelMock.modify.calledWithExactly({
          update: {
            name: "New Network Name",
            action: "update",
          },
          filter: {}, // Modify this according to your implementation of generateFilter.networks
        })
      ).to.be.true;
    });

    it("should handle case when the network update fails", async () => {
      // Stub the NetworkModel.modify method to return a failed response
      const networkModelMock = {
        modify: sinon.stub().resolves({
          success: false,
          message: "Network update failed",
          status: httpStatus.BAD_REQUEST,
        }),
      };
      sinon.stub(createNetwork, "NetworkModel").returns(networkModelMock);

      const request = {
        body: {
          name: "New Network Name",
        },
        query: {
          tenant: "example_tenant",
        },
        action: "update",
      };

      // Call the update method
      const response = await createNetwork.update(request);

      // Verify the response
      expect(response.success).to.be.false;
      expect(response.message).to.equal("Network update failed");
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);

      // Verify the correct methods were called
      expect(networkModelMock.modify.calledOnce).to.be.true;
      expect(
        networkModelMock.modify.calledWithExactly({
          update: {
            name: "New Network Name",
            action: "update",
          },
          filter: {}, // Modify this according to your implementation of generateFilter.networks
        })
      ).to.be.true;
    });

    // Add more test cases as needed for other scenarios
  });
  describe("delete()", () => {
    it("should delete network and update corresponding users", async () => {
      const request = {
        query: {
          tenant: "your-tenant", // Replace with your tenant
        },
        // Add other request parameters here if needed
      };

      const UserModelMock = {
        updateMany: sinon.stub().resolves({ nModified: 2, n: 2 }), // Replace with your desired response
      };

      const NetworkModelMock = {
        remove: sinon.stub().resolves({ success: true }), // Replace with your desired response
      };

      sinon.stub(yourModule, "UserModel").returns(UserModelMock);
      sinon.stub(yourModule, "NetworkModel").returns(NetworkModelMock);

      const response = await yourModule.delete(request);

      expect(response.success).to.be.true;
      expect(UserModelMock.updateMany.calledOnce).to.be.true;
      expect(NetworkModelMock.remove.calledOnce).to.be.true;

      // Restore the stubs after the test
      sinon.restore();
    });

    it("should handle missing network ID", async () => {
      const request = {
        query: {
          tenant: "your-tenant", // Replace with your tenant
        },
        // Add other request parameters here if needed
      };

      // Create a stub for UserModel if needed

      const response = await yourModule.delete(request);

      expect(response.success).to.be.false;
      expect(response.status).to.equal(400); // Check for the expected HTTP status code

      // Restore the stubs after the test
      sinon.restore();
    });

    it("should handle internal server error", async () => {
      const request = {
        query: {
          tenant: "your-tenant", // Replace with your tenant
        },
        // Add other request parameters here if needed
      };

      const UserModelMock = {
        updateMany: sinon.stub().rejects(new Error("Internal server error")), // Simulate an error
      };

      sinon.stub(yourModule, "UserModel").returns(UserModelMock);

      const response = await yourModule.delete(request);

      expect(response.success).to.be.false;
      expect(response.status).to.equal(500); // Check for the expected HTTP status code

      // Restore the stubs after the test
      sinon.restore();
    });
  });
  describe("list", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should list networks successfully", async () => {
      // Stub the generateFilter.networks method to return a successful response
      const generateFilterMock = {
        networks: sinon.stub().returns({
          success: true,
          data: {
            /* Put your generated filter data here */
          },
        }),
      };
      sinon.stub(createNetwork, "generateFilter").returns(generateFilterMock);

      // Stub the NetworkModel.list method to return a successful response
      const networkModelMock = {
        list: sinon.stub().resolves({
          success: true,
          data: {
            /* Put your list of networks data here */
          },
          status: httpStatus.OK,
        }),
      };
      sinon.stub(createNetwork, "NetworkModel").returns(networkModelMock);

      const request = {
        query: {
          skip: 0,
          limit: 10,
          tenant: "example_tenant",
        },
      };

      // Call the list method
      const response = await createNetwork.list(request);

      // Verify the response
      expect(response.success).to.be.true;
      expect(response.data).to.deep.equal({
        /* Put your list of networks data here */
      });
      expect(response.status).to.equal(httpStatus.OK);

      // Verify the correct methods were called
      expect(generateFilterMock.networks.calledOnce).to.be.true;
      expect(generateFilterMock.networks.calledWithExactly(request)).to.be.true;
      expect(networkModelMock.list.calledOnce).to.be.true;
      expect(
        networkModelMock.list.calledWithExactly({
          filter: {
            /* Put your generated filter data here */
          },
          limit: 10,
          skip: 0,
        })
      ).to.be.true;
    });

    it("should handle case when generateFilter.networks fails", async () => {
      // Stub the generateFilter.networks method to return a failed response
      const generateFilterMock = {
        networks: sinon.stub().returns({
          success: false,
          message: "Failed to generate filter",
          status: httpStatus.BAD_REQUEST,
        }),
      };
      sinon.stub(createNetwork, "generateFilter").returns(generateFilterMock);

      const request = {
        query: {
          skip: 0,
          limit: 10,
          tenant: "example_tenant",
        },
      };

      // Call the list method
      const response = await createNetwork.list(request);

      // Verify the response
      expect(response.success).to.be.false;
      expect(response.message).to.equal("Failed to generate filter");
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);

      // Verify the correct methods were called
      expect(generateFilterMock.networks.calledOnce).to.be.true;
      expect(generateFilterMock.networks.calledWithExactly(request)).to.be.true;
      expect(networkModelMock.list.called).to.be.false;
    });

    it("should handle case when NetworkModel.list fails", async () => {
      // Stub the generateFilter.networks method to return a successful response
      const generateFilterMock = {
        networks: sinon.stub().returns({
          success: true,
          data: {
            /* Put your generated filter data here */
          },
        }),
      };
      sinon.stub(createNetwork, "generateFilter").returns(generateFilterMock);

      // Stub the NetworkModel.list method to return a failed response
      const networkModelMock = {
        list: sinon.stub().resolves({
          success: false,
          message: "Failed to list networks",
          status: httpStatus.INTERNAL_SERVER_ERROR,
        }),
      };
      sinon.stub(createNetwork, "NetworkModel").returns(networkModelMock);

      const request = {
        query: {
          skip: 0,
          limit: 10,
          tenant: "example_tenant",
        },
      };

      // Call the list method
      const response = await createNetwork.list(request);

      // Verify the response
      expect(response.success).to.be.false;
      expect(response.message).to.equal("Failed to list networks");
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);

      // Verify the correct methods were called
      expect(generateFilterMock.networks.calledOnce).to.be.true;
      expect(generateFilterMock.networks.calledWithExactly(request)).to.be.true;
      expect(networkModelMock.list.calledOnce).to.be.true;
      expect(
        networkModelMock.list.calledWithExactly({
          filter: {
            /* Put your generated filter data here */
          },
          limit: 10,
          skip: 0,
        })
      ).to.be.true;
    });

    // Add more test cases as needed for other scenarios
  });
  describe("refresh", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should refresh network users successfully", async () => {
      const tenant = "example_tenant";
      const net_id = "network_id";

      // Stub the NetworkModel.findById method to return a network
      /* Put other network data here */
      const networkModelMock = {
        findById: sinon.stub().resolves({
          _id: net_id,
        }),
      };
      sinon.stub(createNetwork, "NetworkModel").returns(networkModelMock);

      // Stub the UserModel.find method to return a list of assigned users
      const user1 = { _id: "user_id_1" };
      const user2 = { _id: "user_id_2" };
      const responseFromListAssignedUsersMock = [user1, user2];
      const userModelMock = {
        find: sinon.stub().resolves(responseFromListAssignedUsersMock),
      };
      sinon.stub(createNetwork, "UserModel").returns(userModelMock);

      // Stub the NetworkModel.findByIdAndUpdate method to return the updated network
      const updatedNetworkMock = {
        _id: net_id /* Put updated network data here */,
      };
      const networkModelUpdateMock = {
        findByIdAndUpdate: sinon.stub().resolves(updatedNetworkMock),
      };
      sinon.stub(createNetwork, "NetworkModel").returns(networkModelUpdateMock);

      const request = {
        query: { tenant },
        params: { net_id },
      };

      // Call the refresh method
      const response = await createNetwork.refresh(request);

      // Verify the response
      expect(response.success).to.be.true;
      expect(response.message).to.equal(
        `Successfully refreshed the network ${net_id} users' details`
      );
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.data).to.deep.equal(updatedNetworkMock);

      // Verify the correct methods were called
      expect(networkModelMock.findById.calledOnce).to.be.true;
      expect(networkModelMock.findById.calledWithExactly(net_id)).to.be.true;
      expect(userModelMock.find.calledOnce).to.be.true;
      expect(
        userModelMock.find.calledWithExactly({ networks: { $in: [net_id] } })
      ).to.be.true;
      expect(networkModelUpdateMock.findByIdAndUpdate.calledOnce).to.be.true;
      expect(
        networkModelUpdateMock.findByIdAndUpdate.calledWithExactly(
          net_id,
          { $addToSet: { net_users: [user1._id, user2._id] } },
          { new: true }
        )
      ).to.be.true;
    });

    it("should handle case when network does not exist", async () => {
      const tenant = "example_tenant";
      const net_id = "non_existent_network_id";

      // Stub the NetworkModel.findById method to return null (network not found)
      const networkModelMock = {
        findById: sinon.stub().resolves(null),
      };
      sinon.stub(createNetwork, "NetworkModel").returns(networkModelMock);

      const request = {
        query: { tenant },
        params: { net_id },
      };

      // Call the refresh method
      const response = await createNetwork.refresh(request);

      // Verify the response
      expect(response.success).to.be.false;
      expect(response.message).to.equal(
        `Invalid network ID ${net_id}, please crosscheck`
      );
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);

      // Verify the correct methods were called
      expect(networkModelMock.findById.calledOnce).to.be.true;
      expect(networkModelMock.findById.calledWithExactly(net_id)).to.be.true;
      expect(createNetwork.UserModel.called).to.be.false;
      expect(networkModelUpdateMock.findByIdAndUpdate.called).to.be.false;
    });

    it("should handle case when UserModel.find fails", async () => {
      const tenant = "example_tenant";
      const net_id = "network_id";

      // Stub the NetworkModel.findById method to return a network
      /* Put other network data here */
      const networkModelMock = {
        findById: sinon.stub().resolves({
          _id: net_id,
        }),
      };
      sinon.stub(createNetwork, "NetworkModel").returns(networkModelMock);

      // Stub the UserModel.find method to throw an error
      const userModelMock = {
        find: sinon.stub().throws(new Error("Database error")),
      };
      sinon.stub(createNetwork, "UserModel").returns(userModelMock);

      const request = {
        query: { tenant },
        params: { net_id },
      };

      // Call the refresh method
      const response = await createNetwork.refresh(request);

      // Verify the response
      expect(response.success).to.be.false;
      expect(response.message).to.equal("Bad Request Errors");
      expect(response.errors.message).to.equal("Database error");
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);

      // Verify the correct methods were called
      expect(networkModelMock.findById.calledOnce).to.be.true;
      expect(networkModelMock.findById.calledWithExactly(net_id)).to.be.true;
      expect(userModelMock.find.calledOnce).to.be.true;
      expect(
        userModelMock.find.calledWithExactly({ networks: { $in: [net_id] } })
      ).to.be.true;
      expect(networkModelUpdateMock.findByIdAndUpdate.called).to.be.false;
    });

    it("should handle case when NetworkModel.findByIdAndUpdate fails", async () => {
      const tenant = "example_tenant";
      const net_id = "network_id";

      // Stub the NetworkModel.findById method to return a network
      const networkModelMock = {
        findById: sinon.stub().resolves({
          _id: net_id,
        }),
      };
      sinon.stub(createNetwork, "NetworkModel").returns(networkModelMock);

      // Stub the UserModel.find method to return a list of assigned users
      const responseFromListAssignedUsersMock = [{ _id: "user_id_1" }];
      const userModelMock = {
        find: sinon.stub().resolves(responseFromListAssignedUsersMock),
      };
      sinon.stub(createNetwork, "UserModel").returns(userModelMock);

      // Stub the NetworkModel.findByIdAndUpdate method to return null (network not found)
      const networkModelUpdateMock = {
        findByIdAndUpdate: sinon.stub().resolves(null),
      };
      sinon.stub(createNetwork, "NetworkModel").returns(networkModelUpdateMock);

      const request = {
        query: { tenant },
        params: { net_id },
      };

      // Call the refresh method
      const response = await createNetwork.refresh(request);

      // Verify the response
      expect(response.success).to.be.false;
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal("Network not found");
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);

      // Verify the correct methods were called
      expect(networkModelMock.findById.calledOnce).to.be.true;
      expect(networkModelMock.findById.calledWithExactly(net_id)).to.be.true;
      expect(userModelMock.find.calledOnce).to.be.true;
      expect(
        userModelMock.find.calledWithExactly({ networks: { $in: [net_id] } })
      ).to.be.true;
      expect(networkModelUpdateMock.findByIdAndUpdate.calledOnce).to.be.true;
      expect(
        networkModelUpdateMock.findByIdAndUpdate.calledWithExactly(
          net_id,
          { $addToSet: { net_users: ["user_id_1"] } },
          { new: true }
        )
      ).to.be.true;
    });

    // Add more test cases as needed for other scenarios
  });
  describe("listAvailableUsers", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should list available users for the network successfully", async () => {
      const tenant = "example_tenant";
      const net_id = "example_net_id";

      // Stub the NetworkModel.findById method to return a network
      const networkModelMock = {
        findById: sinon.stub().returns({
          _id: net_id,
          // Add other network properties as needed
        }),
      };
      sinon.stub(createNetwork, "NetworkModel").returns(networkModelMock);

      // Stub the UserModel.aggregate method to return a list of available users
      const user1 = {
        _id: "user_id_1",
        email: "user1@example.com",
        firstName: "User1",
        lastName: "Last1",
        userName: "user1",
      };
      const user2 = {
        _id: "user_id_2",
        email: "user2@example.com",
        firstName: "User2",
        lastName: "Last2",
        userName: "user2",
      };
      const availableUserList = [user1, user2];
      const userModelMock = {
        aggregate: sinon.stub().returns({
          exec: sinon.stub().returns(availableUserList),
        }),
      };
      sinon.stub(createNetwork, "UserModel").returns(userModelMock);

      // Call the listAvailableUsers method
      const request = {
        query: { tenant },
        params: { net_id },
      };
      const response = await createNetwork.listAvailableUsers(request);

      // Verify the response
      expect(response.success).to.be.true;
      expect(response.message).to.equal(
        `retrieved all available users for network ${net_id}`
      );
      expect(response.data).to.deep.equal(availableUserList);

      // Verify the correct methods were called
      expect(networkModelMock.findById.calledOnce).to.be.true;
      expect(networkModelMock.findById.calledWithExactly(net_id)).to.be.true;
      expect(userModelMock.aggregate.calledOnce).to.be.true;
      expect(
        userModelMock.aggregate.calledWithExactly([
          {
            $match: {
              networks: { $nin: [net_id] },
            },
          },
          {
            $project: {
              _id: 1,
              email: 1,
              firstName: 1,
              lastName: 1,
              createdAt: {
                $dateToString: {
                  format: "%Y-%m-%d %H:%M:%S",
                  date: "$_id",
                },
              },
              userName: 1,
            },
          },
        ])
      ).to.be.true;
    });

    it("should handle case when network ID is invalid", async () => {
      const tenant = "example_tenant";
      const net_id = "invalid_net_id";

      // Stub the NetworkModel.findById method to return null (network not found)
      const networkModelMock = {
        findById: sinon.stub().returns(null),
      };
      sinon.stub(createNetwork, "NetworkModel").returns(networkModelMock);

      const request = {
        query: { tenant },
        params: { net_id },
      };

      // Call the listAvailableUsers method
      const response = await createNetwork.listAvailableUsers(request);

      // Verify the response
      expect(response.success).to.be.false;
      expect(response.message).to.equal(
        `Invalid network ID ${net_id}, please crosscheck`
      );
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);

      // Verify the correct methods were called
      expect(networkModelMock.findById.calledOnce).to.be.true;
      expect(networkModelMock.findById.calledWithExactly(net_id)).to.be.true;
      expect(createNetwork.UserModel.called).to.be.false;
    });

    it("should handle case when UserModel.aggregate fails", async () => {
      const tenant = "example_tenant";
      const net_id = "example_net_id";

      // Stub the NetworkModel.findById method to return a network
      const networkModelMock = {
        findById: sinon.stub().returns({
          _id: net_id,
          // Add other network properties as needed
        }),
      };
      sinon.stub(createNetwork, "NetworkModel").returns(networkModelMock);

      // Stub the UserModel.aggregate method to throw an error
      const userModelMock = {
        aggregate: sinon.stub().throws(new Error("Database error")),
      };
      sinon.stub(createNetwork, "UserModel").returns(userModelMock);

      const request = {
        query: { tenant },
        params: { net_id },
      };

      // Call the listAvailableUsers method
      const response = await createNetwork.listAvailableUsers(request);

      // Verify the response
      expect(response.success).to.be.false;
      expect(response.message).to.equal("Internal Server Error");
      expect(response.errors.message).to.equal("Database error");
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);

      // Verify the correct methods were called
      expect(networkModelMock.findById.calledOnce).to.be.true;
      expect(networkModelMock.findById.calledWithExactly(net_id)).to.be.true;
      expect(userModelMock.aggregate.calledOnce).to.be.true;
      expect(
        userModelMock.aggregate.calledWithExactly([
          {
            $match: {
              networks: { $nin: [net_id] },
            },
          },
          {
            $project: {
              _id: 1,
              email: 1,
              firstName: 1,
              lastName: 1,
              createdAt: {
                $dateToString: {
                  format: "%Y-%m-%d %H:%M:%S",
                  date: "$_id",
                },
              },
              userName: 1,
            },
          },
        ])
      ).to.be.true;
    });

    // Add more test cases as needed for other scenarios
  });
  describe("listAssignedUsers", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should list assigned users for the network successfully", async () => {
      const tenant = "example_tenant";
      const net_id = "example_net_id";

      // Stub the NetworkModel.findById method to return a network
      const networkModelMock = {
        findById: sinon.stub().returns({
          _id: net_id,
          // Add other network properties as needed
        }),
      };
      sinon.stub(createNetwork, "NetworkModel").returns(networkModelMock);

      // Stub the UserModel.aggregate method to return a list of assigned users
      const user1 = {
        _id: "user_id_1",
        email: "user1@example.com",
        firstName: "User1",
        lastName: "Last1",
        userName: "user1",
        jobTitle: "Job1",
        website: "www.example1.com",
        category: "Category1",
        country: "Country1",
        description: "Description1",
      };
      const user2 = {
        _id: "user_id_2",
        email: "user2@example.com",
        firstName: "User2",
        lastName: "Last2",
        userName: "user2",
        jobTitle: "Job2",
        website: "www.example2.com",
        category: "Category2",
        country: "Country2",
        description: "Description2",
      };
      const assignedUserList = [user1, user2];
      const userModelMock = {
        aggregate: sinon.stub().returns({
          exec: sinon.stub().returns(assignedUserList),
        }),
      };
      sinon.stub(createNetwork, "UserModel").returns(userModelMock);

      // Call the listAssignedUsers method
      const request = {
        query: { tenant },
        params: { net_id },
      };
      const response = await createNetwork.listAssignedUsers(request);

      // Verify the response
      expect(response.success).to.be.true;
      expect(response.message).to.equal(
        `retrieved all assigned users for network ${net_id}`
      );
      expect(response.data).to.deep.equal(assignedUserList);

      // Verify the correct methods were called
      expect(networkModelMock.findById.calledOnce).to.be.true;
      expect(networkModelMock.findById.calledWithExactly(net_id)).to.be.true;
      expect(userModelMock.aggregate.calledOnce).to.be.true;
      expect(
        userModelMock.aggregate.calledWithExactly([
          {
            $match: {
              networks: { $in: [net_id] },
            },
          },
          {
            $project: {
              _id: 1,
              email: 1,
              firstName: 1,
              lastName: 1,
              createdAt: {
                $dateToString: {
                  format: "%Y-%m-%d %H:%M:%S",
                  date: "$_id",
                },
              },
              userName: 1,
              jobTitle: 1,
              website: 1,
              category: 1,
              country: 1,
              description: 1,
            },
          },
        ])
      ).to.be.true;
    });

    it("should handle case when network ID is invalid", async () => {
      const tenant = "example_tenant";
      const net_id = "invalid_net_id";

      // Stub the NetworkModel.findById method to return null (network not found)
      const networkModelMock = {
        findById: sinon.stub().returns(null),
      };
      sinon.stub(createNetwork, "NetworkModel").returns(networkModelMock);

      const request = {
        query: { tenant },
        params: { net_id },
      };

      // Call the listAssignedUsers method
      const response = await createNetwork.listAssignedUsers(request);

      // Verify the response
      expect(response.success).to.be.false;
      expect(response.message).to.equal(
        `Invalid network ID ${net_id}, please crosscheck`
      );
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);

      // Verify the correct methods were called
      expect(networkModelMock.findById.calledOnce).to.be.true;
      expect(networkModelMock.findById.calledWithExactly(net_id)).to.be.true;
      expect(createNetwork.UserModel.called).to.be.false;
    });

    it("should handle case when UserModel.aggregate fails", async () => {
      const tenant = "example_tenant";
      const net_id = "example_net_id";

      // Stub the NetworkModel.findById method to return a network
      const networkModelMock = {
        findById: sinon.stub().returns({
          _id: net_id,
          // Add other network properties as needed
        }),
      };
      sinon.stub(createNetwork, "NetworkModel").returns(networkModelMock);

      // Stub the UserModel.aggregate method to throw an error
      const userModelMock = {
        aggregate: sinon.stub().throws(new Error("Database error")),
      };
      sinon.stub(createNetwork, "UserModel").returns(userModelMock);

      const request = {
        query: { tenant },
        params: { net_id },
      };

      // Call the listAssignedUsers method
      const response = await createNetwork.listAssignedUsers(request);

      // Verify the response
      expect(response.success).to.be.false;
      expect(response.message).to.equal("Internal Server Error");
      expect(response.errors.message).to.equal("Database error");
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);

      // Verify the correct methods were called
      expect(networkModelMock.findById.calledOnce).to.be.true;
      expect(networkModelMock.findById.calledWithExactly(net_id)).to.be.true;
      expect(userModelMock.aggregate.calledOnce).to.be.true;
      expect(
        userModelMock.aggregate.calledWithExactly([
          {
            $match: {
              networks: { $in: [net_id] },
            },
          },
          {
            $project: {
              _id: 1,
              email: 1,
              firstName: 1,
              lastName: 1,
              createdAt: {
                $dateToString: {
                  format: "%Y-%m-%d %H:%M:%S",
                  date: "$_id",
                },
              },
              userName: 1,
              jobTitle: 1,
              website: 1,
              category: 1,
              country: 1,
              description: 1,
            },
          },
        ])
      ).to.be.true;
    });

    // Add more test cases as needed for other scenarios
  });
});
