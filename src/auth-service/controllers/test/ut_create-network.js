require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const createNetworkUtil = require("@utils/create-network");
const { validationResult } = require("express-validator");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- network-controller`
);
const controlAccessUtil = require("@utils/control-access");
const createNetwork = require("@controllers/create-network");

describe("createNetwork", () => {
  describe("getNetworkFromEmail", () => {
    it("should get network from email successfully", async () => {
      // Test setup
      const req = {
        query: {
          tenant: "exampleTenant",
        },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const responseFromGetNetworkFromEmail = {
        success: true,
        status: httpStatus.OK,
        message: "Network retrieved successfully",
        data: "exampleNetwork",
      };
      sinon
        .stub(createNetworkUtil, "getNetworkFromEmail")
        .resolves(responseFromGetNetworkFromEmail);

      // Execute the function
      await createNetwork.getNetworkFromEmail(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledWith({
          success: true,
          message: "Network retrieved successfully",
          network_name: "exampleNetwork",
        })
      ).to.be.true;

      // Restore the stub
      createNetworkUtil.getNetworkFromEmail.restore();
    });

    it("should handle error when getting network from email", async () => {
      // Test setup
      const req = {
        query: {
          tenant: "exampleTenant",
        },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const error = new Error("Network retrieval failed");
      sinon.stub(createNetworkUtil, "getNetworkFromEmail").rejects(error);

      // Execute the function
      await createNetwork.getNetworkFromEmail(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: "Network retrieval failed" },
        })
      ).to.be.true;

      // Restore the stub
      createNetworkUtil.getNetworkFromEmail.restore();
    });
  });
  describe("create", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let createNetworkUtilStub;
    let logTextStub;
    let logObjectStub;

    beforeEach(() => {
      req = {
        query: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon.stub();
      badRequestStub = sinon.stub(createNetwork, "badRequest").returns(res);
      createNetworkUtilStub = sinon.stub(
        require("../utils/create-network"),
        "create"
      );
      logTextStub = sinon.stub(require("../utils/log"), "logText");
      logObjectStub = sinon.stub(require("../utils/log"), "logObject");
    });

    afterEach(() => {
      badRequestStub.restore();
      createNetworkUtilStub.restore();
      logTextStub.restore();
      logObjectStub.restore();
    });

    it("should create a new network with default tenant", async () => {
      req.query = {}; // Empty query object, default tenant should be used.
      createNetworkUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Network created successfully.",
        data: {
          networkId: "12345",
          name: "Test Network",
        },
      });

      await createNetwork.create(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Network created successfully.",
          created_network: {
            networkId: "12345",
            name: "Test Network",
          },
        })
      ).to.be.true;
    });

    it("should create a new network with custom tenant", async () => {
      req.query = {
        tenant: "custom-tenant",
      };
      createNetworkUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Network created successfully.",
        data: {
          networkId: "12345",
          name: "Test Network",
        },
      });

      await createNetwork.create(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Network created successfully.",
          created_network: {
            networkId: "12345",
            name: "Test Network",
          },
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      const validationError = {
        isEmpty: () => false,
        errors: [
          {
            msg: "Network name is required.",
            nestedErrors: null,
          },
        ],
      };
      validationResultStub.returns(validationError);
      require("express-validator").validationResult = validationResultStub;

      await createNetwork.create(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(validationError.errors[0].nestedErrors)
        )
      ).to.be.true;
    });

    it("should handle create network failure and return internal server error", async () => {
      const error = new Error("Network creation failed.");
      createNetworkUtilStub.rejects(error);

      await createNetwork.create(req, res);

      expect(logObjectStub.calledOnceWith("the error in production", error)).to
        .be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: error.message },
        })
      ).to.be.true;
    });
  });
  describe("assignUsers", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let createNetworkUtilStub;
    let logTextStub;
    let logObjectStub;
    let loggerErrorStub;

    beforeEach(() => {
      req = {
        query: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon.stub();
      badRequestStub = sinon.stub(assignUsers, "badRequest").returns(res);
      createNetworkUtilStub = sinon.stub(
        require("../utils/create-network"),
        "assignUsers"
      );
      logTextStub = sinon.stub(require("../utils/log"), "logText");
      logObjectStub = sinon.stub(require("../utils/log"), "logObject");
      loggerErrorStub = sinon.stub(require("../utils/logger"), "error");
    });

    afterEach(() => {
      badRequestStub.restore();
      createNetworkUtilStub.restore();
      logTextStub.restore();
      logObjectStub.restore();
      loggerErrorStub.restore();
    });

    it("should assign users to a network with default tenant", async () => {
      req.query = {}; // Empty query object, default tenant should be used.
      createNetworkUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Users assigned successfully.",
        data: {
          networkId: "12345",
          assignedUsers: ["user1", "user2"],
        },
      });

      await assignUsers.assignUsers(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          message: "Users assigned successfully.",
          updated_network: {
            networkId: "12345",
            assignedUsers: ["user1", "user2"],
          },
          success: true,
        })
      ).to.be.true;
    });

    it("should assign users to a network with custom tenant", async () => {
      req.query = {
        tenant: "custom-tenant",
      };
      createNetworkUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Users assigned successfully.",
        data: {
          networkId: "12345",
          assignedUsers: ["user1", "user2"],
        },
      });

      await assignUsers.assignUsers(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          message: "Users assigned successfully.",
          updated_network: {
            networkId: "12345",
            assignedUsers: ["user1", "user2"],
          },
          success: true,
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      const validationError = {
        isEmpty: () => false,
        errors: [
          {
            msg: "Invalid user data.",
            nestedErrors: null,
          },
        ],
      };
      validationResultStub.returns(validationError);
      require("express-validator").validationResult = validationResultStub;

      await assignUsers.assignUsers(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(validationError.errors[0].nestedErrors)
        )
      ).to.be.true;
    });

    it("should handle assign users failure and return internal server error", async () => {
      const error = new Error("Assigning users failed.");
      createNetworkUtilStub.rejects(error);

      await assignUsers.assignUsers(req, res);

      expect(logObjectStub.calledOnceWith("error", error)).to.be.true;
      expect(
        loggerErrorStub.calledOnceWith(
          `Internal Server Error -- ${error.message}`
        )
      ).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: error.message },
        })
      ).to.be.true;
    });
  });
  describe("assignOneUser", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let createNetworkUtilStub;
    let logTextStub;
    let logObjectStub;
    let loggerErrorStub;

    beforeEach(() => {
      req = {
        query: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon.stub();
      badRequestStub = sinon.stub(assignOneUser, "badRequest").returns(res);
      createNetworkUtilStub = sinon.stub(
        require("../utils/create-network"),
        "assignOneUser"
      );
      logTextStub = sinon.stub(require("../utils/log"), "logText");
      logObjectStub = sinon.stub(require("../utils/log"), "logObject");
      loggerErrorStub = sinon.stub(require("../utils/logger"), "error");
    });

    afterEach(() => {
      badRequestStub.restore();
      createNetworkUtilStub.restore();
      logTextStub.restore();
      logObjectStub.restore();
      loggerErrorStub.restore();
    });

    it("should assign one user to a network with default tenant", async () => {
      req.query = {}; // Empty query object, default tenant should be used.
      createNetworkUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "User assigned successfully.",
        data: {
          networkId: "12345",
          assignedUser: "user1",
        },
      });

      await assignOneUser.assignOneUser(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "User assigned successfully.",
          updated_records: {
            networkId: "12345",
            assignedUser: "user1",
          },
        })
      ).to.be.true;
    });

    it("should assign one user to a network with custom tenant", async () => {
      req.query = {
        tenant: "custom-tenant",
      };
      createNetworkUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "User assigned successfully.",
        data: {
          networkId: "12345",
          assignedUser: "user1",
        },
      });

      await assignOneUser.assignOneUser(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "User assigned successfully.",
          updated_records: {
            networkId: "12345",
            assignedUser: "user1",
          },
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      const validationError = {
        isEmpty: () => false,
        errors: [
          {
            msg: "Invalid user data.",
            nestedErrors: null,
          },
        ],
      };
      validationResultStub.returns(validationError);
      require("express-validator").validationResult = validationResultStub;

      await assignOneUser.assignOneUser(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(validationError.errors[0].nestedErrors)
        )
      ).to.be.true;
    });

    it("should handle assign one user failure and return internal server error", async () => {
      const error = new Error("Assigning one user failed.");
      createNetworkUtilStub.rejects(error);

      await assignOneUser.assignOneUser(req, res);

      expect(logObjectStub.calledOnceWith("error", error)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: error.message },
        })
      ).to.be.true;
    });
  });
  describe("unAssignUser", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let createNetworkUtilStub;
    let logTextStub;
    let logObjectStub;
    let loggerErrorStub;

    beforeEach(() => {
      req = {
        query: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon.stub();
      badRequestStub = sinon.stub(unAssignUser, "badRequest").returns(res);
      createNetworkUtilStub = sinon.stub(
        require("../utils/create-network"),
        "unAssignUser"
      );
      logTextStub = sinon.stub(require("../utils/log"), "logText");
      logObjectStub = sinon.stub(require("../utils/log"), "logObject");
      loggerErrorStub = sinon.stub(require("../utils/logger"), "error");
    });

    afterEach(() => {
      badRequestStub.restore();
      createNetworkUtilStub.restore();
      logTextStub.restore();
      logObjectStub.restore();
      loggerErrorStub.restore();
    });

    it("should unassign user from a network with default tenant", async () => {
      req.query = {}; // Empty query object, default tenant should be used.
      createNetworkUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "User unassigned successfully.",
        data: {
          networkId: "12345",
          unassignedUser: "user1",
        },
      });

      await unAssignUser.unAssignUser(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "User unassigned successfully.",
          updated_records: {
            networkId: "12345",
            unassignedUser: "user1",
          },
        })
      ).to.be.true;
    });

    it("should unassign user from a network with custom tenant", async () => {
      req.query = {
        tenant: "custom-tenant",
      };
      createNetworkUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "User unassigned successfully.",
        data: {
          networkId: "12345",
          unassignedUser: "user1",
        },
      });

      await unAssignUser.unAssignUser(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "User unassigned successfully.",
          updated_records: {
            networkId: "12345",
            unassignedUser: "user1",
          },
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      const validationError = {
        isEmpty: () => false,
        errors: [
          {
            msg: "Invalid user data.",
            nestedErrors: null,
          },
        ],
      };
      validationResultStub.returns(validationError);
      require("express-validator").validationResult = validationResultStub;

      await unAssignUser.unAssignUser(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(validationError.errors[0].nestedErrors)
        )
      ).to.be.true;
    });

    it("should handle unassign user failure and return internal server error", async () => {
      const error = new Error("Unassigning user failed.");
      createNetworkUtilStub.rejects(error);

      await unAssignUser.unAssignUser(req, res);

      expect(logObjectStub.calledOnceWith("error", error)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: error.message },
        })
      ).to.be.true;
    });
  });
  describe("unAssignManyUsers", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let createNetworkUtilStub;
    let logTextStub;
    let logObjectStub;
    let loggerErrorStub;

    beforeEach(() => {
      req = {
        query: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon.stub();
      badRequestStub = sinon.stub(unAssignManyUsers, "badRequest").returns(res);
      createNetworkUtilStub = sinon.stub(
        require("../utils/create-network"),
        "unAssignManyUsers"
      );
      logTextStub = sinon.stub(require("../utils/log"), "logText");
      logObjectStub = sinon.stub(require("../utils/log"), "logObject");
      loggerErrorStub = sinon.stub(require("../utils/logger"), "error");
    });

    afterEach(() => {
      badRequestStub.restore();
      createNetworkUtilStub.restore();
      logTextStub.restore();
      logObjectStub.restore();
      loggerErrorStub.restore();
    });

    it("should unassign many users from a network with default tenant", async () => {
      req.query = {}; // Empty query object, default tenant should be used.
      createNetworkUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Users unassigned successfully.",
        data: {
          networkId: "12345",
          unassignedUsers: ["user1", "user2"],
        },
      });

      await unAssignManyUsers.unAssignManyUsers(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Users unassigned successfully.",
          updated_records: {
            networkId: "12345",
            unassignedUsers: ["user1", "user2"],
          },
        })
      ).to.be.true;
    });

    it("should unassign many users from a network with custom tenant", async () => {
      req.query = {
        tenant: "custom-tenant",
      };
      createNetworkUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Users unassigned successfully.",
        data: {
          networkId: "12345",
          unassignedUsers: ["user1", "user2"],
        },
      });

      await unAssignManyUsers.unAssignManyUsers(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Users unassigned successfully.",
          updated_records: {
            networkId: "12345",
            unassignedUsers: ["user1", "user2"],
          },
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      const validationError = {
        isEmpty: () => false,
        errors: [
          {
            msg: "Invalid user data.",
            nestedErrors: null,
          },
        ],
      };
      validationResultStub.returns(validationError);
      require("express-validator").validationResult = validationResultStub;

      await unAssignManyUsers.unAssignManyUsers(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(validationError.errors[0].nestedErrors)
        )
      ).to.be.true;
    });

    it("should handle unassign many users failure and return internal server error", async () => {
      const error = new Error("Unassigning many users failed.");
      createNetworkUtilStub.rejects(error);

      await unAssignManyUsers.unAssignManyUsers(req, res);

      expect(logObjectStub.calledOnceWith("error", error)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: error.message },
        })
      ).to.be.true;
    });
  });
  describe("setManager", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let createNetworkUtilStub;
    let logTextStub;
    let logObjectStub;

    beforeEach(() => {
      req = {
        query: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon.stub();
      badRequestStub = sinon.stub(setManager, "badRequest").returns(res);
      createNetworkUtilStub = sinon.stub(
        require("../utils/create-network"),
        "setManager"
      );
      logTextStub = sinon.stub(require("../utils/log"), "logText");
      logObjectStub = sinon.stub(require("../utils/log"), "logObject");
    });

    afterEach(() => {
      badRequestStub.restore();
      createNetworkUtilStub.restore();
      logTextStub.restore();
      logObjectStub.restore();
    });

    it("should set the network manager with default tenant", async () => {
      req.query = {}; // Empty query object, default tenant should be used.
      createNetworkUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Network manager set successfully.",
        data: {
          networkId: "12345",
          manager: "manager1",
        },
      });

      await setManager.setManager(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Network manager set successfully.",
          updated_network: {
            networkId: "12345",
            manager: "manager1",
          },
        })
      ).to.be.true;
    });

    it("should set the network manager with custom tenant", async () => {
      req.query = {
        tenant: "custom-tenant",
      };
      createNetworkUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Network manager set successfully.",
        data: {
          networkId: "12345",
          manager: "manager1",
        },
      });

      await setManager.setManager(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Network manager set successfully.",
          updated_network: {
            networkId: "12345",
            manager: "manager1",
          },
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      const validationError = {
        isEmpty: () => false,
        errors: [
          {
            msg: "Invalid user data.",
            nestedErrors: null,
          },
        ],
      };
      validationResultStub.returns(validationError);
      require("express-validator").validationResult = validationResultStub;

      await setManager.setManager(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(validationError.errors[0].nestedErrors)
        )
      ).to.be.true;
    });

    it("should handle setting network manager failure and return internal server error", async () => {
      const error = new Error("Setting network manager failed.");
      createNetworkUtilStub.rejects(error);

      await setManager.setManager(req, res);

      expect(logObjectStub.calledOnceWith("error", error)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: error.message },
        })
      ).to.be.true;
    });
  });
  describe("update", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let createNetworkUtilStub;
    let logTextStub;
    let logElementStub;
    let logObjectStub;

    beforeEach(() => {
      req = {
        query: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon.stub();
      badRequestStub = sinon.stub(update, "badRequest").returns(res);
      createNetworkUtilStub = sinon.stub(
        require("../utils/create-network"),
        "update"
      );
      logTextStub = sinon.stub(require("../utils/log"), "logText");
      logElementStub = sinon.stub(require("../utils/log"), "logElement");
      logObjectStub = sinon.stub(require("../utils/log"), "logObject");
    });

    afterEach(() => {
      badRequestStub.restore();
      createNetworkUtilStub.restore();
      logTextStub.restore();
      logElementStub.restore();
      logObjectStub.restore();
    });

    it("should update user with default tenant", async () => {
      req.query = {}; // Empty query object, default tenant should be used.
      createNetworkUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Network updated successfully.",
        data: {
          networkId: "12345",
          name: "Updated Network",
        },
      });

      await update.update(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Network updated successfully.",
          updated_network: {
            networkId: "12345",
            name: "Updated Network",
          },
        })
      ).to.be.true;
    });

    it("should update user with custom tenant", async () => {
      req.query = {
        tenant: "custom-tenant",
      };
      createNetworkUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Network updated successfully.",
        data: {
          networkId: "12345",
          name: "Updated Network",
        },
      });

      await update.update(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Network updated successfully.",
          updated_network: {
            networkId: "12345",
            name: "Updated Network",
          },
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      const validationError = {
        isEmpty: () => false,
        errors: [
          {
            msg: "Invalid user data.",
            nestedErrors: null,
          },
        ],
      };
      validationResultStub.returns(validationError);
      require("express-validator").validationResult = validationResultStub;

      await update.update(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(validationError.errors[0].nestedErrors)
        )
      ).to.be.true;
    });

    it("should handle updating network failure and return internal server error", async () => {
      const error = new Error("Updating network failed.");
      createNetworkUtilStub.rejects(error);

      await update.update(req, res);

      expect(logObjectStub.calledOnceWith("error", error)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: error.message },
        })
      ).to.be.true;
    });
  });
  describe("refresh", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let createNetworkUtilStub;
    let logTextStub;
    let logElementStub;
    let logObjectStub;

    beforeEach(() => {
      req = {
        query: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon.stub();
      badRequestStub = sinon.stub(refresh, "badRequest").returns(res);
      createNetworkUtilStub = sinon.stub(
        require("../utils/create-network"),
        "refresh"
      );
      logTextStub = sinon.stub(require("../utils/log"), "logText");
      logElementStub = sinon.stub(require("../utils/log"), "logElement");
      logObjectStub = sinon.stub(require("../utils/log"), "logObject");
    });

    afterEach(() => {
      badRequestStub.restore();
      createNetworkUtilStub.restore();
      logTextStub.restore();
      logElementStub.restore();
      logObjectStub.restore();
    });

    it("should refresh user with default tenant", async () => {
      req.query = {}; // Empty query object, default tenant should be used.
      createNetworkUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Network refreshed successfully.",
        data: {
          networkId: "12345",
          name: "Refreshed Network",
        },
      });

      await refresh.refresh(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Network refreshed successfully.",
          refreshed_network: {
            networkId: "12345",
            name: "Refreshed Network",
          },
        })
      ).to.be.true;
    });

    it("should refresh user with custom tenant", async () => {
      req.query = {
        tenant: "custom-tenant",
      };
      createNetworkUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Network refreshed successfully.",
        data: {
          networkId: "12345",
          name: "Refreshed Network",
        },
      });

      await refresh.refresh(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Network refreshed successfully.",
          refreshed_network: {
            networkId: "12345",
            name: "Refreshed Network",
          },
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      const validationError = {
        isEmpty: () => false,
        errors: [
          {
            msg: "Invalid user data.",
            nestedErrors: null,
          },
        ],
      };
      validationResultStub.returns(validationError);
      require("express-validator").validationResult = validationResultStub;

      await refresh.refresh(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(validationError.errors[0].nestedErrors)
        )
      ).to.be.true;
    });

    it("should handle refreshing network failure and return internal server error", async () => {
      const error = new Error("Refreshing network failed.");
      createNetworkUtilStub.rejects(error);

      await refresh.refresh(req, res);

      expect(logObjectStub.calledOnceWith("error", error)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: error.message },
        })
      ).to.be.true;
    });
  });
  describe("delete", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let createNetworkUtilStub;
    let logTextStub;
    let logElementStub;
    let logObjectStub;

    beforeEach(() => {
      req = {
        query: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon.stub();
      badRequestStub = sinon.stub(deleteUser, "badRequest").returns(res);
      createNetworkUtilStub = sinon.stub(
        require("../utils/create-network"),
        "delete"
      );
      logTextStub = sinon.stub(require("../utils/log"), "logText");
      logElementStub = sinon.stub(require("../utils/log"), "logElement");
      logObjectStub = sinon.stub(require("../utils/log"), "logObject");
    });

    afterEach(() => {
      badRequestStub.restore();
      createNetworkUtilStub.restore();
      logTextStub.restore();
      logElementStub.restore();
      logObjectStub.restore();
    });

    it("should delete user with default tenant", async () => {
      req.query = {}; // Empty query object, default tenant should be used.
      createNetworkUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Network deleted successfully.",
        data: {
          networkId: "12345",
          name: "Deleted Network",
        },
      });

      await deleteUser.delete(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Network deleted successfully.",
          deleted_network: {
            networkId: "12345",
            name: "Deleted Network",
          },
        })
      ).to.be.true;
    });

    it("should delete user with custom tenant", async () => {
      req.query = {
        tenant: "custom-tenant",
      };
      createNetworkUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Network deleted successfully.",
        data: {
          networkId: "12345",
          name: "Deleted Network",
        },
      });

      await deleteUser.delete(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Network deleted successfully.",
          deleted_network: {
            networkId: "12345",
            name: "Deleted Network",
          },
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      const validationError = {
        isEmpty: () => false,
        errors: [
          {
            msg: "Invalid user data.",
            nestedErrors: null,
          },
        ],
      };
      validationResultStub.returns(validationError);
      require("express-validator").validationResult = validationResultStub;

      await deleteUser.delete(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(validationError.errors[0].nestedErrors)
        )
      ).to.be.true;
    });

    it("should handle deleting network failure and return internal server error", async () => {
      const error = new Error("Deleting network failed.");
      createNetworkUtilStub.rejects(error);

      await deleteUser.delete(req, res);

      expect(logObjectStub.calledOnceWith("error", error)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: error.message },
        })
      ).to.be.true;
    });
  });
  describe("list", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let createNetworkUtilStub;
    let logTextStub;
    let logElementStub;
    let logObjectStub;

    beforeEach(() => {
      req = {
        query: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon.stub();
      badRequestStub = sinon.stub(listUsers, "badRequest").returns(res);
      createNetworkUtilStub = sinon.stub(
        require("../utils/create-network"),
        "list"
      );
      logTextStub = sinon.stub(require("../utils/log"), "logText");
      logElementStub = sinon.stub(require("../utils/log"), "logElement");
      logObjectStub = sinon.stub(require("../utils/log"), "logObject");
    });

    afterEach(() => {
      badRequestStub.restore();
      createNetworkUtilStub.restore();
      logTextStub.restore();
      logElementStub.restore();
      logObjectStub.restore();
    });

    it("should list users with default tenant", async () => {
      req.query = {}; // Empty query object, default tenant should be used.
      createNetworkUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Users listed successfully.",
        data: [
          {
            userId: "user1",
            name: "User One",
          },
          {
            userId: "user2",
            name: "User Two",
          },
        ],
      });

      await listUsers.list(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Users listed successfully.",
          networks: [
            {
              userId: "user1",
              name: "User One",
            },
            {
              userId: "user2",
              name: "User Two",
            },
          ],
        })
      ).to.be.true;
    });

    it("should list users with custom tenant", async () => {
      req.query = {
        tenant: "custom-tenant",
      };
      createNetworkUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Users listed successfully.",
        data: [
          {
            userId: "user1",
            name: "User One",
          },
          {
            userId: "user2",
            name: "User Two",
          },
        ],
      });

      await listUsers.list(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Users listed successfully.",
          networks: [
            {
              userId: "user1",
              name: "User One",
            },
            {
              userId: "user2",
              name: "User Two",
            },
          ],
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      const validationError = {
        isEmpty: () => false,
        errors: [
          {
            msg: "Invalid user data.",
            nestedErrors: null,
          },
        ],
      };
      validationResultStub.returns(validationError);
      require("express-validator").validationResult = validationResultStub;

      await listUsers.list(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(validationError.errors[0].nestedErrors)
        )
      ).to.be.true;
    });

    it("should handle listing users failure and return internal server error", async () => {
      const error = new Error("Listing users failed.");
      createNetworkUtilStub.rejects(error);

      await listUsers.list(req, res);

      expect(
        logElementStub.calledOnceWith("internal server error", error.message)
      ).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: error.message },
        })
      ).to.be.true;
    });
  });
  describe("listSummary", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let createNetworkUtilStub;
    let logTextStub;
    let logElementStub;
    let logObjectStub;

    beforeEach(() => {
      req = {
        query: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon.stub();
      badRequestStub = sinon.stub(listSummary, "badRequest").returns(res);
      createNetworkUtilStub = sinon.stub(
        require("../utils/create-network"),
        "list"
      );
      logTextStub = sinon.stub(require("../utils/log"), "logText");
      logElementStub = sinon.stub(require("../utils/log"), "logElement");
      logObjectStub = sinon.stub(require("../utils/log"), "logObject");
    });

    afterEach(() => {
      badRequestStub.restore();
      createNetworkUtilStub.restore();
      logTextStub.restore();
      logElementStub.restore();
      logObjectStub.restore();
    });

    it("should list summary of networks with default tenant", async () => {
      req.query = {}; // Empty query object, default tenant should be used.
      createNetworkUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Networks summary listed successfully.",
        data: [
          {
            networkId: "network1",
            summary: {
              totalUsers: 100,
              totalDevices: 50,
              totalDataPoints: 5000,
            },
          },
          {
            networkId: "network2",
            summary: {
              totalUsers: 50,
              totalDevices: 25,
              totalDataPoints: 2500,
            },
          },
        ],
      });

      await listSummary.listSummary(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Networks summary listed successfully.",
          networks: [
            {
              networkId: "network1",
              summary: {
                totalUsers: 100,
                totalDevices: 50,
                totalDataPoints: 5000,
              },
            },
            {
              networkId: "network2",
              summary: {
                totalUsers: 50,
                totalDevices: 25,
                totalDataPoints: 2500,
              },
            },
          ],
        })
      ).to.be.true;
    });

    it("should list summary of networks with custom tenant", async () => {
      req.query = {
        tenant: "custom-tenant",
      };
      createNetworkUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Networks summary listed successfully.",
        data: [
          {
            networkId: "network1",
            summary: {
              totalUsers: 100,
              totalDevices: 50,
              totalDataPoints: 5000,
            },
          },
          {
            networkId: "network2",
            summary: {
              totalUsers: 50,
              totalDevices: 25,
              totalDataPoints: 2500,
            },
          },
        ],
      });

      await listSummary.listSummary(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Networks summary listed successfully.",
          networks: [
            {
              networkId: "network1",
              summary: {
                totalUsers: 100,
                totalDevices: 50,
                totalDataPoints: 5000,
              },
            },
            {
              networkId: "network2",
              summary: {
                totalUsers: 50,
                totalDevices: 25,
                totalDataPoints: 2500,
              },
            },
          ],
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      const validationError = {
        isEmpty: () => false,
        errors: [
          {
            msg: "Invalid user data.",
            nestedErrors: null,
          },
        ],
      };
      validationResultStub.returns(validationError);
      require("express-validator").validationResult = validationResultStub;

      await listSummary.listSummary(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(validationError.errors[0].nestedErrors)
        )
      ).to.be.true;
    });

    it("should handle listing summary of networks failure and return internal server error", async () => {
      const error = new Error("Listing summary of networks failed.");
      createNetworkUtilStub.rejects(error);

      await listSummary.listSummary(req, res);

      expect(
        logElementStub.calledOnceWith("internal server error", error.message)
      ).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: error.message },
        })
      ).to.be.true;
    });
  });
  describe("listRolesForNetwork", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;
    let logTextStub;
    let logObjectStub;
    let loggerErrorStub;

    beforeEach(() => {
      req = {
        query: {},
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon.stub();
      badRequestStub = sinon
        .stub(listRolesForNetwork, "badRequest")
        .returns(res);
      controlAccessUtilStub = sinon.stub(
        require("../utils/control-access"),
        "listRolesForNetwork"
      );
      logTextStub = sinon.stub(require("../utils/log"), "logText");
      logObjectStub = sinon.stub(require("../utils/log"), "logObject");
      loggerErrorStub = sinon.stub(require("../utils/log"), "logger.error");
    });

    afterEach(() => {
      badRequestStub.restore();
      controlAccessUtilStub.restore();
      logTextStub.restore();
      logObjectStub.restore();
      loggerErrorStub.restore();
    });

    it("should list roles for network with default tenant", async () => {
      req.query = {}; // Empty query object, default tenant should be used.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Network roles listed successfully.",
        data: [
          {
            roleId: "role1",
            roleName: "Admin",
          },
          {
            roleId: "role2",
            roleName: "User",
          },
        ],
      });

      await listRolesForNetwork.listRolesForNetwork(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Network roles listed successfully.",
          network_roles: [
            {
              roleId: "role1",
              roleName: "Admin",
            },
            {
              roleId: "role2",
              roleName: "User",
            },
          ],
        })
      ).to.be.true;
    });

    it("should list roles for network with custom tenant", async () => {
      req.query = {
        tenant: "custom-tenant",
      };
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Network roles listed successfully.",
        data: [
          {
            roleId: "role1",
            roleName: "Admin",
          },
          {
            roleId: "role2",
            roleName: "User",
          },
        ],
      });

      await listRolesForNetwork.listRolesForNetwork(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Network roles listed successfully.",
          network_roles: [
            {
              roleId: "role1",
              roleName: "Admin",
            },
            {
              roleId: "role2",
              roleName: "User",
            },
          ],
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      const validationError = {
        isEmpty: () => false,
        errors: [
          {
            msg: "Invalid user data.",
            nestedErrors: null,
          },
        ],
      };
      validationResultStub.returns(validationError);
      require("express-validator").validationResult = validationResultStub;

      await listRolesForNetwork.listRolesForNetwork(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(validationError.errors[0].nestedErrors)
        )
      ).to.be.true;
    });

    it("should handle listing roles for network failure and return internal server error", async () => {
      const error = new Error("Listing roles for network failed.");
      controlAccessUtilStub.rejects(error);

      await listRolesForNetwork.listRolesForNetwork(req, res);

      expect(
        loggerErrorStub.calledOnceWith(
          `internal server error -- ${error.message}`
        )
      ).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: error.message },
        })
      ).to.be.true;
    });
  });
  describe("listAssignedUsers", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let createNetworkUtilStub;
    let logTextStub;
    let logObjectStub;
    let loggerErrorStub;

    beforeEach(() => {
      req = {
        query: {},
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon.stub();
      badRequestStub = sinon.stub(listAssignedUsers, "badRequest").returns(res);
      createNetworkUtilStub = sinon.stub(
        require("../utils/createNetworkUtil"),
        "listAssignedUsers"
      );
      logTextStub = sinon.stub(require("../utils/log"), "logText");
      logObjectStub = sinon.stub(require("../utils/log"), "logObject");
      loggerErrorStub = sinon.stub(require("../utils/log"), "logger.error");
    });

    afterEach(() => {
      badRequestStub.restore();
      createNetworkUtilStub.restore();
      logTextStub.restore();
      logObjectStub.restore();
      loggerErrorStub.restore();
    });

    it("should list assigned users with default tenant and empty data", async () => {
      req.query = {}; // Empty query object, default tenant should be used.
      createNetworkUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "No assigned users to this network.",
        data: [],
      });

      await listAssignedUsers.listAssignedUsers(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "no assigned users to this network",
          assigned_users: [],
        })
      ).to.be.true;
    });

    it("should list assigned users with custom tenant and non-empty data", async () => {
      req.query = {
        tenant: "custom-tenant",
      };
      createNetworkUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Successfully retrieved the assigned users for this network.",
        data: [
          {
            userId: "user1",
            userName: "John Doe",
          },
          {
            userId: "user2",
            userName: "Jane Smith",
          },
        ],
      });

      await listAssignedUsers.listAssignedUsers(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "successfully retrieved the assigned users for this network",
          assigned_users: [
            {
              userId: "user1",
              userName: "John Doe",
            },
            {
              userId: "user2",
              userName: "Jane Smith",
            },
          ],
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      const validationError = {
        isEmpty: () => false,
        errors: [
          {
            msg: "Invalid user data.",
            nestedErrors: null,
          },
        ],
      };
      validationResultStub.returns(validationError);
      require("express-validator").validationResult = validationResultStub;

      await listAssignedUsers.listAssignedUsers(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(validationError.errors[0].nestedErrors)
        )
      ).to.be.true;
    });

    it("should handle listing assigned users failure and return internal server error", async () => {
      const error = new Error("Listing assigned users failed.");
      createNetworkUtilStub.rejects(error);

      await listAssignedUsers.listAssignedUsers(req, res);

      expect(
        loggerErrorStub.calledOnceWith(
          `internal server error -- ${error.message}`
        )
      ).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: error.message },
        })
      ).to.be.true;
    });
  });
  describe("listAvailableUsers", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let createNetworkUtilStub;
    let logTextStub;
    let logObjectStub;
    let loggerErrorStub;

    beforeEach(() => {
      req = {
        query: {},
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon.stub();
      badRequestStub = sinon
        .stub(listAvailableUsers, "badRequest")
        .returns(res);
      createNetworkUtilStub = sinon.stub(
        require("../utils/createNetworkUtil"),
        "listAvailableUsers"
      );
      logTextStub = sinon.stub(require("../utils/log"), "logText");
      logObjectStub = sinon.stub(require("../utils/log"), "logObject");
      loggerErrorStub = sinon.stub(require("../utils/log"), "logger.error");
    });

    afterEach(() => {
      badRequestStub.restore();
      createNetworkUtilStub.restore();
      logTextStub.restore();
      logObjectStub.restore();
      loggerErrorStub.restore();
    });

    it("should list available users with default tenant and empty data", async () => {
      req.query = {}; // Empty query object, default tenant should be used.
      createNetworkUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "No available users.",
        data: [],
      });

      await listAvailableUsers.listAvailableUsers(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "no available users",
          available_users: [],
        })
      ).to.be.true;
    });

    it("should list available users with custom tenant and non-empty data", async () => {
      req.query = {
        tenant: "custom-tenant",
      };
      createNetworkUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Successfully retrieved available users.",
        data: [
          {
            userId: "user1",
            userName: "John Doe",
          },
          {
            userId: "user2",
            userName: "Jane Smith",
          },
        ],
      });

      await listAvailableUsers.listAvailableUsers(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "successfully retrieved available users",
          available_users: [
            {
              userId: "user1",
              userName: "John Doe",
            },
            {
              userId: "user2",
              userName: "Jane Smith",
            },
          ],
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      const validationError = {
        isEmpty: () => false,
        errors: [
          {
            msg: "Invalid user data.",
            nestedErrors: null,
          },
        ],
      };
      validationResultStub.returns(validationError);
      require("express-validator").validationResult = validationResultStub;

      await listAvailableUsers.listAvailableUsers(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(validationError.errors[0].nestedErrors)
        )
      ).to.be.true;
    });

    it("should handle listing available users failure and return internal server error", async () => {
      const error = new Error("Listing available users failed.");
      createNetworkUtilStub.rejects(error);

      await listAvailableUsers.listAvailableUsers(req, res);

      expect(
        loggerErrorStub.calledOnceWith(
          `internal server error -- ${error.message}`
        )
      ).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: error.message },
        })
      ).to.be.true;
    });
  });
  // Add similar test cases for other methods in the createNetwork object...
});
