require("module-alias/register");
const chai = require("chai");
const chaiHttp = require("chai-http");
const should = chai.should();
const expect = chai.expect;
const assert = chai.assert;
const faker = require("faker");
const sinon = require("sinon");
chai.use(chaiHttp);
const CandidateModel = require("@models/Candidate");
const UserModel = require("@models/User");
const generateFilterUtil = require("@utils/generate-filter");

const stubValue = {
  _id: faker.datatype.uuid(),
  tenant: "airqo",
  createdAt: faker.date.past(),
  updatedAt: faker.date.past(),
};

describe("generate-filter util", function () {
  describe("filter search_histories", () => {
    it("should return an empty filter when no query or params provided", () => {
      const req = {};
      const result = generateFilterUtil.search_histories(req);

      expect(result).to.deep.equal({});
    });

    it("should correctly filter by _id when id is provided in the query", () => {
      const req = {
        query: {
          id: "1234567890abcdef12345678",
        },
      };
      const result = generateFilterUtil.search_histories(req);

      expect(result).to.deep.equal({
        _id: "1234567890abcdef12345678",
      });
    });

    it("should correctly filter by _id when search_history_id is provided in the params", () => {
      const req = {
        params: {
          search_history_id: "abcdef123456789012345678",
        },
      };
      const result = generateFilterUtil.search_histories(req);

      expect(result).to.deep.equal({
        _id: "abcdef123456789012345678",
      });
    });

    it("should correctly filter by firebase_user_id when firebase_user_id is provided in the params", () => {
      const req = {
        params: {
          firebase_user_id: "test_firebase_user_id",
        },
      };
      const result = generateFilterUtil.search_histories(req);

      expect(result).to.deep.equal({
        firebase_user_id: "test_firebase_user_id",
      });
    });

    it("should prioritize search_history_id over id when both are provided", () => {
      const req = {
        query: {
          id: "1234567890abcdef12345678",
        },
        params: {
          search_history_id: "abcdef123456789012345678",
        },
      };
      const result = generateFilterUtil.search_histories(req);

      expect(result).to.deep.equal({
        _id: "abcdef123456789012345678",
      });
    });
  });
  describe("filter candidates", function () {
    it("should filter candidates", async function () {
      const stub = sinon
        .stub(CandidateModel(stubValue.tenant), "create")
        .returns(stubValue);

      const site = await generateFilterUtil.createSite(
        stubValue.tenant,
        stubValue.latitude,
        stubValue.longitude,
        stubValue.name
      );

      expect(stub.calledOnce).to.be.true;
      expect(site._id).to.equal(stubValue._id);
      expect(site.name).to.equal(stubValue.name);
      expect(site.generated_name).to.equal(stubValue.generated_name);
      expect(site.formatted_name).to.equal(stubValue.formatted_name);
      expect(site.createdAt).to.equal(stubValue.createdAt);
      expect(site.updatedAt).to.equal(stubValue.updatedAt);
    });
  });
  describe("filter users", function () {
    it("should retrieve a Site that matches the provided ID", async function () {
      const stub = sinon
        .stub(CandidateModel(stubValue.tenant), "list")
        .returns(stubValue);

      let filter = { lat_long: stubValue.lat_long };

      const site = await generateFilterUtil.getSite(stubValue.tenant, filter);
      expect(stub.calledOnce).to.be.true;
      expect(site._id).to.equal(stubValue._id);
      expect(site.name).to.equal(stubValue.name);
      expect(site.generated_name).to.equal(stubValue.generated_name);
      expect(site.formatted_name).to.equal(stubValue.formatted_name);
      expect(site.createdAt).to.equal(stubValue.createdAt);
      expect(site.updatedAt).to.equal(stubValue.updatedAt);
    });
  });
  describe("filter defaults", function () {
    it("should update the Site and return the updated details", async function () {
      const stub = sinon
        .stub(CandidateModel(stubValue.tenant), "update")
        .returns(stubValue);

      let body = stubValue;
      delete body.lat_long;

      const updatedSite = await generateFilterUtil.updateSite(
        stubValue.tenant,
        stubValue.lat_long,
        body
      );

      expect(stub.calledOnce).to.be.true;
      expect(updatedSite).to.not.be.empty;
      expect(updatedSite).to.be.a("object");
    });
  });
  describe("filter networks", function () {
    it("should generate a filter for networks", function () {
      // Mock the request object with query parameters and params
      const req = {
        query: {
          net_email: "example@example.com",
          net_category: "example_category",
          net_tenant: "airqo",
          net_status: "active",
          net_phoneNumber: "123456789",
          net_website: "https://www.example.com",
          net_acronym: "NET",
          category: "example_category",
        },
        params: {
          net_id: "net_id_here",
        },
      };

      // Call the networks function with the mocked request object
      const result = generateFilterUtil.networks(req);

      // Assert the expected output
      expect(result).to.deep.equal({
        success: true,
        message: "successfully created the filter",
        data: {
          net_email: "example@example.com",
          net_category: "example_category",
          net_tenant: "airqo",
          net_status: "active",
          net_phoneNumber: "123456789",
          net_website: "https://www.example.com",
          net_acronym: "NET",
          category: "example_category",
          _id: "net_id_here", // Assuming you use ObjectId("net_id_here")
        },
      });
    });

    it("should handle errors and return the appropriate response", function () {
      // Mock the request object with an error
      const req = {
        query: {},
        params: {},
      };

      // Call the networks function with the mocked request object
      const result = generateFilterUtil.networks(req);

      // Assert the expected error response
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Cannot read property 'toLowerCase' of undefined" }, // Replace with the actual error message
        status: 500, // Replace with the appropriate HTTP status code for internal server errors
      });
    });
  });
  describe("filter inquiry", function () {
    it("should generate a filter for inquiry", function () {
      // Mock the request object with query parameters and body
      const req = {
        query: {
          category: "example_category",
          id: "example_id",
        },
        body: {
          email: "example@example.com",
        },
      };

      // Call the inquiry function with the mocked request object
      const result = generateFilterUtil.inquiry(req);

      // Assert the expected output
      expect(result).to.deep.equal({
        success: true,
        message: "successfully created the filter",
        data: {
          email: "example@example.com",
          category: "example_category",
          _id: "example_id",
        },
        status: 200, // Assuming 200 is the expected HTTP status code for success
      });
    });

    it("should handle errors and return the appropriate response", function () {
      // Mock the request object with an error
      const req = {
        query: {},
        body: {},
      };

      // Call the inquiry function with the mocked request object
      const result = generateFilterUtil.inquiry(req);

      // Assert the expected error response
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Cannot read property 'toLowerCase' of undefined" }, // Replace with the actual error message
        status: 500, // Replace with the appropriate HTTP status code for internal server errors
      });
    });
  });
  describe("filter roles", function () {
    it("should generate a filter for roles", function () {
      // Mock the request object with query parameters and params
      const req = {
        query: {
          id: "example_id",
          role_name: "example_role_name",
          role_code: "example_role_code",
          network_id: "example_network_id",
          role_status: "example_role_status",
          category: "example_category",
        },
        params: {
          role_id: "example_role_id",
        },
      };

      // Call the roles function with the mocked request object
      const result = generateFilterUtil.roles(req);

      // Assert the expected output
      expect(result).to.deep.equal({
        _id: "example_role_id",
        role_name: "example_role_name",
        role_code: "example_role_code",
        network_id: "example_network_id",
        role_status: "example_role_status",
        category: "example_category",
      });
    });

    it("should handle errors and return the appropriate response", function () {
      // Mock the request object with an error
      const req = {
        query: {},
        params: {},
      };

      // Call the roles function with the mocked request object
      const result = generateFilterUtil.roles(req);

      // Assert the expected error response
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Cannot read property 'toLowerCase' of undefined" }, // Replace with the actual error message
        status: 500, // Replace with the appropriate HTTP status code for internal server errors
      });
    });
  });
  describe("filter permissions", function () {
    it("should generate a filter for permissions", function () {
      // Mock the request object with query parameters and params
      const req = {
        query: {
          id: "example_id",
          network: "example_network",
          permission: "example_permission",
        },
        params: {
          permission_id: "example_permission_id",
          network_id: "example_network_id",
        },
      };

      // Call the permissions function with the mocked request object
      const result = generateFilterUtil.permissions(req);

      // Assert the expected output
      expect(result).to.deep.equal({
        _id: "example_id",
        permission: "example_permission_id",
        network_id: "example_network_id",
      });
    });

    it("should handle errors and return the appropriate response", function () {
      // Mock the request object with an error
      const req = {
        query: {},
        params: {},
      };

      // Call the permissions function with the mocked request object
      const result = generateFilterUtil.permissions(req);

      // Assert the expected error response
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Cannot read property 'toLowerCase' of undefined" }, // Replace with the actual error message
        status: 500, // Replace with the appropriate HTTP status code for internal server errors
      });
    });
  });
  describe("filter tokens", function () {
    it("should generate a filter for tokens", function () {
      // Mock the request object with query parameters and params
      const req = {
        query: {
          id: "example_id",
        },
        params: {
          token: "example_token",
          user_id: "example_user_id",
          network_id: "example_network_id",
          client_id: "example_client_id",
        },
      };

      // Call the tokens function with the mocked request object
      const result = generateFilterUtil.tokens(req);

      // Assert the expected output
      expect(result).to.deep.equal({
        _id: "example_id",
        token: "example_token",
        user_id: "example_user_id",
        network_id: "example_network_id",
        client_id: "example_client_id",
      });
    });

    it("should handle errors and return the appropriate response", function () {
      // Mock the request object with an error
      const req = {
        query: {},
        params: {},
      };

      // Call the tokens function with the mocked request object
      const result = generateFilterUtil.tokens(req);

      // Assert the expected error response
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Cannot read property 'toLowerCase' of undefined" }, // Replace with the actual error message
        status: 500, // Replace with the appropriate HTTP status code for internal server errors
      });
    });
  });
  describe("filter clients", function () {
    it("should generate a filter for clients", function () {
      // Mock the request object with query parameters and params
      const req = {
        query: {
          id: "example_id",
        },
        params: {
          client_id: "example_client_id",
          client_name: "example_client_name",
          network_id: "network_id_1,network_id_2",
          client_secret: "example_client_secret",
        },
      };

      // Call the clients function with the mocked request object
      const result = generateFilterUtil.clients(req);

      // Assert the expected output
      expect(result).to.deep.equal({
        _id: "example_id",
        client_id: "example_client_id",
        client_name: "example_client_name",
        networks: {
          $in: ["network_id_1", "network_id_2"], // The actual ObjectId conversion may vary based on the MongoDB library used
        },
        client_secret: "example_client_secret",
      });
    });

    it("should handle errors and return the appropriate response", function () {
      // Mock the request object with an error
      const req = {
        query: {},
        params: {},
      };

      // Call the clients function with the mocked request object
      const result = generateFilterUtil.clients(req);

      // Assert the expected error response
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Cannot read property 'toLowerCase' of undefined" }, // Replace with the actual error message
        status: 500, // Replace with the appropriate HTTP status code for internal server errors
      });
    });
  });
  describe("filter scopes", function () {
    it("should generate a filter for scopes", function () {
      // Mock the request object with query parameters and params
      const req = {
        query: {
          id: "example_id",
          scope: "example_scope",
        },
        params: {
          scope_id: "example_scope_id",
          network_id: "example_network_id",
        },
      };

      // Call the scopes function with the mocked request object
      const result = generateFilterUtil.scopes(req);

      // Assert the expected output
      expect(result).to.deep.equal({
        _id: "example_id",
        scope: "example_scope",
        network_id: "example_network_id",
      });
    });

    it("should handle errors and return the appropriate response", function () {
      // Mock the request object with an error
      const req = {
        query: {},
        params: {},
      };

      // Call the scopes function with the mocked request object
      const result = generateFilterUtil.scopes(req);

      // Assert the expected error response
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Cannot read property 'toLowerCase' of undefined" }, // Replace with the actual error message
        status: 500, // Replace with the appropriate HTTP status code for internal server errors
      });
    });
  });
  describe("filter departments", function () {
    it("should generate a filter for departments", function () {
      // Mock the request object with query parameters and params
      const req = {
        query: {
          dep_status: "example_status",
          dep_network_id: "example_network_id",
          dep_children: "example_children",
        },
        params: {
          dep_id: "example_dep_id",
          user_id: "example_user_id",
        },
      };

      // Call the departments function with the mocked request object
      const result = generateFilterUtil.departments(req);

      // Assert the expected output
      expect(result).to.deep.equal({
        _id: "example_dep_id",
        net_status: "example_status",
        dep_network_id: "example_network_id",
        dep_children: "example_children",
      });
    });

    it("should handle errors and return the appropriate response", function () {
      // Mock the request object with an error
      const req = {
        query: {},
        params: {},
      };

      // Call the departments function with the mocked request object
      const result = generateFilterUtil.departments(req);

      // Assert the expected error response
      expect(result).to.deep.equal({
        success: false,
        message: "internal server error",
        errors: { message: "Cannot read property 'toLowerCase' of undefined" }, // Replace with the actual error message
        status: 500, // Replace with the appropriate HTTP status code for internal server errors
      });
    });
  });
  describe("filter groups", function () {
    it("should generate a filter for groups", function () {
      // Mock the request object with query parameters and params
      const req = {
        query: {
          grp_status: "example_status",
          grp_network_id: "example_network_id",
          grp_users: "user_id1,user_id2",
          grp_description: "example_description",
          grp_tasks: "example_tasks",
          grp_title: "example_title",
        },
        params: {
          grp_id: "example_grp_id",
        },
      };

      // Call the groups function with the mocked request object
      const result = generateFilterUtil.groups(req);

      // Assert the expected output
      expect(result).to.deep.equal({
        _id: "example_grp_id",
        grp_status: "example_status",
        grp_network_id: "example_network_id",
        grp_users: { $in: ["user_id1", "user_id2"] },
        grp_description: "example_description",
        grp_tasks: "example_tasks",
        grp_title: "example_title",
      });
    });

    it("should handle errors and return the appropriate response", function () {
      // Mock the request object with an error
      const req = {
        query: {},
        params: {},
      };

      // Call the groups function with the mocked request object
      const result = generateFilterUtil.groups(req);

      // Assert the expected error response
      expect(result).to.deep.equal({
        success: false,
        message: "internal server error",
        errors: { message: "Cannot read property 'split' of undefined" }, // Replace with the actual error message
        status: 500, // Replace with the appropriate HTTP status code for internal server errors
      });
    });
  });
  describe("filter logs", function () {
    it("should generate a filter for logs with startTime and endTime", function () {
      // Mock the request object with query parameters
      const req = {
        query: {
          service: "example_service",
          startTime: "2023-07-15T00:00:00.000Z",
          endTime: "2023-07-22T00:00:00.000Z",
          email: "example_email@example.com",
        },
      };

      // Call the logs function with the mocked request object
      const result = generateFilterUtil.logs(req);

      // Assert the expected output
      expect(result).to.deep.equal({
        timestamp: {
          $gte: new Date("2023-07-15T00:00:00.000Z"),
          $lte: new Date("2023-07-22T00:00:00.000Z"),
        },
        "meta.service": "example_service",
        "meta.email": "example_email@example.com",
      });
    });

    it("should generate a filter for logs with only startTime", function () {
      // Mock the request object with query parameters
      const req = {
        query: {
          startTime: "2023-07-15T00:00:00.000Z",
        },
      };

      // Call the logs function with the mocked request object
      const result = generateFilterUtil.logs(req);

      // Assert the expected output
      expect(result).to.deep.equal({
        timestamp: {
          $gte: new Date("2023-07-15T00:00:00.000Z"),
        },
      });
    });

    it("should generate a filter for logs with only endTime", function () {
      // Mock the request object with query parameters
      const req = {
        query: {
          endTime: "2023-07-22T00:00:00.000Z",
        },
      };

      // Call the logs function with the mocked request object
      const result = generateFilterUtil.logs(req);

      // Assert the expected output
      expect(result).to.deep.equal({
        timestamp: {
          $lte: new Date("2023-07-22T00:00:00.000Z"),
        },
      });
    });

    it("should generate a filter for logs with email", function () {
      // Mock the request object with query parameters
      const req = {
        query: {
          email: "example_email@example.com",
        },
      };

      // Call the logs function with the mocked request object
      const result = generateFilterUtil.logs(req);

      // Assert the expected output
      expect(result).to.deep.equal({
        "meta.email": "example_email@example.com",
      });
    });

    it("should handle errors and return the appropriate response", function () {
      // Mock the request object with an error
      const req = {
        query: {},
      };

      // Call the logs function with the mocked request object
      const result = generateFilterUtil.logs(req);

      // Assert the expected error response
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: {
          message: "Cannot read properties of undefined (reading 'length')",
        }, // Replace with the actual error message
        status: 500, // Replace with the appropriate HTTP status code for internal server errors
      });
    });
  });
  describe("filter favorites", function () {
    it("should generate a filter for favorites with firebase_user_id", function () {
      // Mock the request object with query and params
      const req = {
        query: {},
        params: {
          firebase_user_id: "example_firebase_user_id",
        },
      };

      // Call the favorites function with the mocked request object
      const result = generateFilterUtil.favorites(req);

      // Assert the expected output
      expect(result).to.deep.equal({
        firebase_user_id: "example_firebase_user_id",
      });
    });

    it("should generate a filter for favorites with favorite_id", function () {
      // Mock the request object with query and params
      const req = {
        query: {
          favorite_id: "example_favorite_id",
        },
        params: {},
      };

      // Call the favorites function with the mocked request object
      const result = generateFilterUtil.favorites(req);

      // Assert the expected output
      expect(result).to.deep.equal({
        _id: ObjectId("example_favorite_id"),
      });
    });

    it("should generate a filter for favorites with id", function () {
      // Mock the request object with query and params
      const req = {
        query: {
          id: "example_id",
        },
        params: {},
      };

      // Call the favorites function with the mocked request object
      const result = generateFilterUtil.favorites(req);

      // Assert the expected output
      expect(result).to.deep.equal({
        _id: ObjectId("example_id"),
      });
    });

    it("should handle errors and return the appropriate response", function () {
      // Mock the request object with an error
      const req = {
        query: {},
        params: {},
      };

      // Call the favorites function with the mocked request object
      const result = generateFilterUtil.favorites(req);

      // Assert the expected error response
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: {
          message: "Cannot read properties of undefined (reading 'length')",
        }, // Replace with the actual error message
        status: 500, // Replace with the appropriate HTTP status code for internal server errors
      });
    });
  });
});
