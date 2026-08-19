require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const httpStatus = require("http-status");
const { HttpError } = require("@utils/shared");
const { generateFilter } = require("@utils/common");

/**
 * Every function in generate-filter.util.js has the signature (req, next) => {}.
 * On success it returns the plain filter object directly (no {success,message,data}
 * envelope). On error (catch block) it calls next(new HttpError(...)) and does NOT
 * return an error-shaped object - the function's return value in that case is
 * whatever next() itself returns (usually undefined for a stub/spy).
 *
 * This helper asserts that `next` was invoked exactly once with an HttpError whose
 * shape matches what generate-filter.util.js actually constructs:
 *   new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
 *     message: error.message,
 *   })
 * Because HttpError converts a plain {message: "<string>"} errors object into the
 * legacy validation-array shape, `.errors` ends up as:
 *   [{ param: "message", message: "<original error message>", location: "body" }]
 */
function expectNextCalledWithInternalServerError(nextStub, originalErrorMessage) {
  expect(nextStub.calledOnce).to.be.true;
  const err = nextStub.getCall(0).args[0];
  expect(err).to.be.instanceOf(HttpError);
  expect(err.message).to.equal("Internal Server Error");
  expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
  expect(err.errors).to.deep.equal([
    { param: "message", message: originalErrorMessage, location: "body" },
  ]);
}

describe("generate-filter util", function () {
  describe("search_histories", () => {
    it("should return an empty filter when no query or params provided", () => {
      const req = { query: {}, params: {} };
      const result = generateFilter.search_histories(req);

      expect(result).to.deep.equal({});
    });

    it("should wrap id in an ObjectId when id is provided in the query", () => {
      const id = "507f1f77bcf86cd799439011";
      const req = { query: { id }, params: {} };
      const result = generateFilter.search_histories(req);

      expect(result).to.deep.equal({ _id: ObjectId(id) });
    });

    it("should wrap search_history_id in an ObjectId when provided in params", () => {
      const searchHistoryId = "507f191e810c19729de860ea";
      const req = { query: {}, params: { search_history_id: searchHistoryId } };
      const result = generateFilter.search_histories(req);

      expect(result).to.deep.equal({ _id: ObjectId(searchHistoryId) });
    });

    it("should filter by firebase_user_id (kept as a plain string, not wrapped)", () => {
      const req = { query: {}, params: { firebase_user_id: "test_firebase_user_id" } };
      const result = generateFilter.search_histories(req);

      expect(result).to.deep.equal({ firebase_user_id: "test_firebase_user_id" });
    });

    it("should let search_history_id (params) win over id (query) since it is applied later", () => {
      const id = "507f1f77bcf86cd799439011";
      const searchHistoryId = "507f191e810c19729de860ea";
      const req = {
        query: { id },
        params: { search_history_id: searchHistoryId },
      };
      const result = generateFilter.search_histories(req);

      expect(result).to.deep.equal({ _id: ObjectId(searchHistoryId) });
    });

    it("should call next with an Internal Server Error when id is not a valid ObjectId", () => {
      const next = sinon.stub();
      const req = { query: { id: "not-a-valid-id" }, params: {} };

      const result = generateFilter.search_histories(req, next);

      expect(result).to.be.undefined;
      expectNextCalledWithInternalServerError(
        next,
        "Argument passed in must be a single String of 12 bytes or a string of 24 hex characters"
      );
    });
  });

  describe("favorites", function () {
    it("should filter by firebase_user_id when provided in params", function () {
      const req = { query: {}, params: { firebase_user_id: "example_firebase_user_id" } };

      const result = generateFilter.favorites(req);

      expect(result).to.deep.equal({ firebase_user_id: "example_firebase_user_id" });
    });

    it("should wrap favorite_id in an ObjectId when provided in the query", function () {
      const favoriteId = "5f43a6220b7e2f001f6b8a2b";
      const req = { query: { favorite_id: favoriteId }, params: {} };

      const result = generateFilter.favorites(req);

      expect(result).to.deep.equal({ _id: ObjectId(favoriteId) });
    });

    it("should wrap id in an ObjectId when provided in the query, and let favorite_id win if both are present", function () {
      const id = "507f1f77bcf86cd799439011";
      const favoriteId = "5f43a6220b7e2f001f6b8a2b";
      const req = { query: { id, favorite_id: favoriteId }, params: {} };

      const result = generateFilter.favorites(req);

      expect(result).to.deep.equal({ _id: ObjectId(favoriteId) });
    });

    it("should call next with an Internal Server Error when favorite_id is not a valid ObjectId", function () {
      const next = sinon.stub();
      const req = { query: { favorite_id: "not-a-valid-id" }, params: {} };

      const result = generateFilter.favorites(req, next);

      expect(result).to.be.undefined;
      expectNextCalledWithInternalServerError(
        next,
        "Argument passed in must be a single String of 12 bytes or a string of 24 hex characters"
      );
    });
  });

  describe("location_histories", function () {
    it("should filter by firebase_user_id when provided in params", function () {
      const req = { query: {}, params: { firebase_user_id: "example_firebase_user_id" } };

      const result = generateFilter.location_histories(req);

      expect(result).to.deep.equal({ firebase_user_id: "example_firebase_user_id" });
    });

    it("should wrap location_history_id in an ObjectId, taking precedence over id", function () {
      const id = "507f1f77bcf86cd799439011";
      const locationHistoryId = "5f43a6220b7e2f001f6b8a2b";
      const req = {
        query: { id, location_history_id: locationHistoryId },
        params: {},
      };

      const result = generateFilter.location_histories(req);

      expect(result).to.deep.equal({ _id: ObjectId(locationHistoryId) });
    });

    it("should call next with an Internal Server Error when id is not a valid ObjectId", function () {
      const next = sinon.stub();
      const req = { query: { id: "not-a-valid-id" }, params: {} };

      const result = generateFilter.location_histories(req, next);

      expect(result).to.be.undefined;
      expectNextCalledWithInternalServerError(
        next,
        "Argument passed in must be a single String of 12 bytes or a string of 24 hex characters"
      );
    });
  });

  // NOTE: the old file had a "filter candidates" describe block here that called
  // generateFilter.createSite(...) - that function does not exist anywhere in
  // generate-filter.util.js (it looks like leftover copy/paste from an unrelated
  // site-util test). Replaced with real coverage of generateFilter.candidates.
  describe("candidates", function () {
    it("should build a filter from email, category and id", function () {
      const id = "507f1f77bcf86cd799439011";
      const req = {
        body: {},
        query: { category: "example_category", id },
        params: {},
      };
      req.body.email = "Example@Example.com";

      const result = generateFilter.candidates(req);

      expect(result).to.deep.equal({
        email: "example@example.com",
        category: "example_category",
        _id: ObjectId(id),
      });
    });

    it("should wrap network_id in an ObjectId", function () {
      const networkId = "507f191e810c19729de860ea";
      const req = { body: {}, query: { network_id: networkId }, params: {} };

      const result = generateFilter.candidates(req);

      expect(result).to.deep.equal({ network_id: ObjectId(networkId) });
    });

    it("should let email_address win over email since it is applied later", function () {
      const req = {
        body: { email: "first@example.com" },
        query: { email_address: "second@example.com" },
        params: {},
      };

      const result = generateFilter.candidates(req);

      expect(result).to.deep.equal({ email: "second@example.com" });
    });

    it("should let params win over query win over body (merge order)", function () {
      const bodyId = "507f1f77bcf86cd799439011";
      const queryId = "507f191e810c19729de860ea";
      const paramsId = "5f43a6220b7e2f001f6b8a2b";
      const req = {
        body: { id: bodyId },
        query: { id: queryId },
        params: { id: paramsId },
      };

      const result = generateFilter.candidates(req);

      expect(result).to.deep.equal({ _id: ObjectId(paramsId) });
    });

    it("should call next with an Internal Server Error when network_id is not a valid ObjectId", function () {
      const next = sinon.stub();
      const req = { body: {}, query: { network_id: "not-a-valid-id" }, params: {} };

      const result = generateFilter.candidates(req, next);

      expect(result).to.be.undefined;
      expectNextCalledWithInternalServerError(
        next,
        "Argument passed in must be a single String of 12 bytes or a string of 24 hex characters"
      );
    });
  });

  // NOTE: the old file had a "filter users" describe block that called
  // generateFilter.getSite(...), a function that doesn't exist. Replaced with
  // real coverage of generateFilter.users.
  describe("users", function () {
    it("should build a filter covering all independent fields", function () {
      const id = "507f1f77bcf86cd799439011";
      const roleId = "507f191e810c19729de860ea";
      const req = {
        body: {},
        query: {},
        params: {
          id,
          role_id: roleId,
          username: "john",
          active: "yes",
          email: "Test@Example.com ",
          resetPasswordToken: "tok123",
          privilege: "admin",
          login_count: "5",
        },
      };

      const result = generateFilter.users(req);

      expect(result).to.deep.equal({
        email: "test@example.com",
        role: ObjectId(roleId),
        resetPasswordToken: "tok123",
        privilege: "admin",
        _id: ObjectId(id),
        isActive: true,
        userName: "john",
        login_count: 5,
      });
    });

    it("should let email_address win over email since it is applied later", function () {
      const req = {
        body: {},
        query: { email: "first@example.com", email_address: "second@example.com" },
        params: {},
      };

      const result = generateFilter.users(req);

      expect(result).to.deep.equal({ email: "second@example.com" });
    });

    it("should let user win over user_id win over id for the _id field, in that evaluation order", function () {
      const idFromId = "507f1f77bcf86cd799439011";
      const idFromUserId = "507f191e810c19729de860ea";
      const idFromUser = "5f43a6220b7e2f001f6b8a2b";
      const req = {
        body: {},
        query: {},
        params: { id: idFromId, user_id: idFromUserId, user: idFromUser },
      };

      const result = generateFilter.users(req);

      expect(result).to.deep.equal({ _id: ObjectId(idFromUser) });
    });

    it("should map active=no to isActive:false and ignore other active values", function () {
      const reqNo = { body: {}, query: {}, params: { active: "no" } };
      expect(generateFilter.users(reqNo)).to.deep.equal({ isActive: false });

      const reqOther = { body: {}, query: {}, params: { active: "maybe" } };
      expect(generateFilter.users(reqOther)).to.deep.equal({});
    });

    it("should let params win over query win over body (merge order)", function () {
      const req = {
        body: { username: "from-body" },
        query: { username: "from-query" },
        params: { username: "from-params" },
      };

      const result = generateFilter.users(req);

      expect(result).to.deep.equal({ userName: "from-params" });
    });

    it("should call next with an Internal Server Error when id is not a valid ObjectId", function () {
      const next = sinon.stub();
      const req = { body: {}, query: {}, params: { id: "not-a-valid-id" } };

      const result = generateFilter.users(req, next);

      expect(result).to.be.undefined;
      expectNextCalledWithInternalServerError(
        next,
        "Argument passed in must be a single String of 12 bytes or a string of 24 hex characters"
      );
    });
  });

  // NOTE: the old file had a "filter defaults" describe block that called
  // generateFilter.updateSite(...), a function that doesn't exist. Replaced with
  // real coverage of generateFilter.defaults.
  describe("defaults", function () {
    it("should wrap every recognised id-like field in an ObjectId", function () {
      const site = "507f1f77bcf86cd799439011";
      const airqloud = "507f191e810c19729de860ea";
      const grid = "5f43a6220b7e2f001f6b8a2b";
      const cohort = "60c72b2f9b1e8a001c8e4d3a";
      const group_id = "60c72b2f9b1e8a001c8e4d3b";
      const network_id = "60c72b2f9b1e8a001c8e4d3c";
      const id = "60c72b2f9b1e8a001c8e4d3d";
      const req = {
        query: { site, airqloud, grid, cohort, group_id, network_id, id },
        params: {},
      };

      const result = generateFilter.defaults(req);

      expect(result).to.deep.equal({
        _id: ObjectId(id),
        grid: ObjectId(grid),
        cohort: ObjectId(cohort),
        group_id: ObjectId(group_id),
        network_id: ObjectId(network_id),
        site: ObjectId(site),
        airqloud: ObjectId(airqloud),
      });
    });

    it("should let user_id win over user for the user field, since it is applied later", function () {
      const userFromUser = "507f1f77bcf86cd799439011";
      const userFromUserId = "507f191e810c19729de860ea";
      const req = {
        query: { user: userFromUser, user_id: userFromUserId },
        params: {},
      };

      const result = generateFilter.defaults(req);

      expect(result).to.deep.equal({ user: ObjectId(userFromUserId) });
    });

    it("should ignore req.body entirely - only query and params are merged", function () {
      const req = {
        body: { site: "507f1f77bcf86cd799439011" },
        query: {},
        params: {},
      };

      const result = generateFilter.defaults(req);

      expect(result).to.deep.equal({});
    });

    it("should call next with an Internal Server Error when grid is not a valid ObjectId", function () {
      const next = sinon.stub();
      const req = { query: { grid: "not-a-valid-id" }, params: {} };

      const result = generateFilter.defaults(req, next);

      expect(result).to.be.undefined;
      expectNextCalledWithInternalServerError(
        next,
        "Argument passed in must be a single String of 12 bytes or a string of 24 hex characters"
      );
    });
  });

  describe("networks", function () {
    it("should generate a filter for networks, wrapping net_id in an ObjectId", function () {
      const netId = "507f1f77bcf86cd799439011";
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
        params: { net_id: netId },
      };

      const result = generateFilter.networks(req);

      expect(result).to.deep.equal({
        net_email: "example@example.com",
        category: "example_category",
        net_category: "example_category",
        _id: ObjectId(netId),
        net_tenant: "airqo",
        net_acronym: "NET",
        net_phoneNumber: "123456789",
        net_website: "https://www.example.com",
        net_status: "active",
      });
    });

    it("should return an empty filter when no query or params are provided", function () {
      const req = { query: {}, params: {} };

      const result = generateFilter.networks(req);

      expect(result).to.deep.equal({});
    });

    it("should call next with an Internal Server Error when net_email is not a string", function () {
      const next = sinon.stub();
      const req = { query: { net_email: 12345 }, params: {} };

      const result = generateFilter.networks(req, next);

      expect(result).to.be.undefined;
      expectNextCalledWithInternalServerError(
        next,
        "net_email.toLowerCase is not a function"
      );
    });
  });

  describe("inquiry", function () {
    it("should generate a filter for inquiry (id is kept as-is, NOT wrapped in an ObjectId)", function () {
      const req = {
        query: { category: "example_category", id: "example_id" },
        body: { email: "example@example.com" },
      };

      const result = generateFilter.inquiry(req);

      expect(result).to.deep.equal({
        email: "example@example.com",
        category: "example_category",
        _id: "example_id",
      });
    });

    it("should call next with an Internal Server Error when email is not a string", function () {
      const next = sinon.stub();
      const req = { query: {}, body: { email: 12345 } };

      const result = generateFilter.inquiry(req, next);

      expect(result).to.be.undefined;
      expectNextCalledWithInternalServerError(
        next,
        "email.toLowerCase is not a function"
      );
    });
  });

  describe("roles", () => {
    // roles() reads `{ ...params, ...query }` - i.e. QUERY wins over params on a
    // key collision, the opposite of most other filter functions in this module.
    it("should build a filter from id/network/group aliases", () => {
      const id = "507f1f77bcf86cd799439011";
      const networkId = "507f191e810c19729de860ea";
      const groupId = "5f43a6220b7e2f001f6b8a2b";
      const req = {
        query: {
          role_id: id,
          net_id: networkId,
          group_id: groupId,
          category: "category",
          role_name: "role_name",
          role_code: "role_code",
          role_status: "active",
        },
        params: {},
      };

      const filter = generateFilter.roles(req);

      expect(filter).to.deep.equal({
        _id: ObjectId(id),
        network_id: ObjectId(networkId),
        group_id: ObjectId(groupId),
        category: "category",
        role_name: "role_name",
        role_code: "role_code",
        role_status: "active",
      });
    });

    it("should let query win over params on a key collision (merge order is params-then-query)", () => {
      const idFromParams = "507f1f77bcf86cd799439011";
      const idFromQuery = "507f191e810c19729de860ea";
      const req = {
        query: { id: idFromQuery },
        params: { id: idFromParams },
      };

      const filter = generateFilter.roles(req);

      expect(filter).to.deep.equal({ _id: ObjectId(idFromQuery) });
    });

    it("should handle missing parameters", () => {
      const req = { query: {}, params: {} };

      const filter = generateFilter.roles(req);

      expect(filter).to.deep.equal({});
    });

    it("permission_filter, user_id and include_permissions are no-ops - they never reach the returned filter", () => {
      const req = {
        query: {
          permission_filter: "some_permission",
          user_id: "507f1f77bcf86cd799439011",
          include_permissions: "true",
        },
        params: {},
      };

      const filter = generateFilter.roles(req);

      expect(filter).to.deep.equal({});
    });

    it("should call next with an Internal Server Error when id/role_id is not a valid ObjectId", () => {
      const next = sinon.stub();
      const req = { query: { role_id: "not-a-valid-id" }, params: {} };

      const filter = generateFilter.roles(req, next);

      expect(filter).to.be.undefined;
      expectNextCalledWithInternalServerError(
        next,
        "Argument passed in must be a single String of 12 bytes or a string of 24 hex characters"
      );
    });
  });

  describe("permissions", function () {
    // permissions() does NOT merge query and params. It reads
    // `{ id, network, permission } = query` and
    // `{ permission_id, network_id } = params` separately, then applies them to
    // the filter in this fixed order: id, permission_id, network, network_id,
    // permission. So when both permission (query) and permission_id (params) are
    // present, permission (query) wins because it's applied last - even though
    // permission_id comes from params.
    it("should generate a filter, with query's `permission` winning over params' `permission_id`", function () {
      const id = "507f1f77bcf86cd799439011";
      const networkId = "507f191e810c19729de860ea";
      const req = {
        query: { id, permission: "example_permission" },
        params: { permission_id: "example_permission_id", network_id: networkId },
      };

      const result = generateFilter.permissions(req);

      expect(result).to.deep.equal({
        _id: ObjectId(id),
        permission: "example_permission",
        network_id: ObjectId(networkId),
      });
    });

    it("should fall back to permission_id (params) when query has no permission", function () {
      const req = {
        query: {},
        params: { permission_id: "example_permission_id" },
      };

      const result = generateFilter.permissions(req);

      expect(result).to.deep.equal({ permission: "example_permission_id" });
    });

    it("should call next with an Internal Server Error when id is not a valid ObjectId", function () {
      const next = sinon.stub();
      const req = { query: { id: "not-a-valid-id" }, params: {} };

      const result = generateFilter.permissions(req, next);

      expect(result).to.be.undefined;
      expectNextCalledWithInternalServerError(
        next,
        "Argument passed in must be a single String of 12 bytes or a string of 24 hex characters"
      );
    });
  });

  describe("tokens", function () {
    // tokens() only recognises token, client_id, name, id and emailed. It does
    // NOT have user_id/network_id fields at all - any such query/param keys are
    // silently ignored.
    it("should generate a filter, wrapping id and client_id in ObjectIds", function () {
      const id = "507f1f77bcf86cd799439011";
      const clientId = "507f191e810c19729de860ea";
      const req = {
        query: { id },
        params: {
          token: "example_token",
          client_id: clientId,
          name: "example_name",
          user_id: "should_be_ignored",
          network_id: "should_be_ignored",
        },
      };

      const result = generateFilter.tokens(req);

      expect(result).to.deep.equal({
        _id: ObjectId(id),
        token: "example_token",
        client_id: ObjectId(clientId),
        name: "example_name",
      });
    });

    it("should map emailed=yes to expiredEmailSent:true, and anything else to false", function () {
      const reqYes = { query: {}, params: { emailed: "yes" } };
      expect(generateFilter.tokens(reqYes)).to.deep.equal({ expiredEmailSent: true });

      const reqNo = { query: {}, params: { emailed: "no" } };
      expect(generateFilter.tokens(reqNo)).to.deep.equal({ expiredEmailSent: false });
    });

    it("should call next with an Internal Server Error when emailed is not a string", function () {
      const next = sinon.stub();
      const req = { query: {}, params: { emailed: 12345 } };

      const result = generateFilter.tokens(req, next);

      expect(result).to.be.undefined;
      expectNextCalledWithInternalServerError(
        next,
        "emailed.toLowerCase is not a function"
      );
    });
  });

  describe("clients", function () {
    // clients() reads `{ id, user_id } = query` and
    // `{ client_id, client_name, network_id, client_secret } = params`
    // separately. client_name and network_id are destructured but never used to
    // build the filter - they are pure no-ops, and there is no `networks: {$in:
    // [...]}` behaviour anywhere in the real function.
    it("should generate a filter with only _id, user_id and client_secret", function () {
      const userId = "507f1f77bcf86cd799439011";
      const clientId = "507f191e810c19729de860ea";
      const req = {
        query: { user_id: userId },
        params: {
          client_id: clientId,
          client_name: "ignored_no_op_field",
          network_id: "ignored_no_op_field",
          client_secret: "example_client_secret",
        },
      };

      const result = generateFilter.clients(req);

      expect(result).to.deep.equal({
        _id: ObjectId(clientId),
        user_id: ObjectId(userId),
        client_secret: "example_client_secret",
      });
    });

    it("should let client_id (params) win over id (query) since it is applied later", function () {
      const idFromQuery = "507f1f77bcf86cd799439011";
      const clientIdFromParams = "507f191e810c19729de860ea";
      const req = {
        query: { id: idFromQuery },
        params: { client_id: clientIdFromParams },
      };

      const result = generateFilter.clients(req);

      expect(result).to.deep.equal({ _id: ObjectId(clientIdFromParams) });
    });

    it("should call next with an Internal Server Error when id is not a valid ObjectId", function () {
      const next = sinon.stub();
      const req = { query: { id: "not-a-valid-id" }, params: {} };

      const result = generateFilter.clients(req, next);

      expect(result).to.be.undefined;
      expectNextCalledWithInternalServerError(
        next,
        "Argument passed in must be a single String of 12 bytes or a string of 24 hex characters"
      );
    });
  });

  describe("scopes", function () {
    it("should generate a filter, wrapping _id and network_id in ObjectIds", function () {
      const id = "507f1f77bcf86cd799439011";
      const networkId = "507f191e810c19729de860ea";
      const req = {
        query: { id, scope: "example_scope" },
        params: { scope_id: "5f43a6220b7e2f001f6b8a2b", network_id: networkId },
      };

      const result = generateFilter.scopes(req);

      expect(result).to.deep.equal({
        _id: ObjectId(id),
        scope: "example_scope",
        network_id: ObjectId(networkId),
      });
    });

    it("should only fall back to scope_id when id is absent (else-if, not an override)", function () {
      const scopeId = "5f43a6220b7e2f001f6b8a2b";
      const req = { query: {}, params: { scope_id: scopeId } };

      const result = generateFilter.scopes(req);

      expect(result).to.deep.equal({ _id: ObjectId(scopeId) });
    });

    it("should call next with an Internal Server Error when id is not a valid ObjectId", function () {
      const next = sinon.stub();
      const req = { query: { id: "not-a-valid-id" }, params: {} };

      const result = generateFilter.scopes(req, next);

      expect(result).to.be.undefined;
      expectNextCalledWithInternalServerError(
        next,
        "Argument passed in must be a single String of 12 bytes or a string of 24 hex characters"
      );
    });
  });

  describe("departments", function () {
    // dep_email, dep_title, dep_parent, dep_manager, has_children, dep_acronym
    // and user_id are all destructured but never applied to the filter - no-ops.
    it("should generate a filter, wrapping dep_id and dep_network_id in ObjectIds", function () {
      const depId = "507f1f77bcf86cd799439011";
      const depNetworkId = "507f191e810c19729de860ea";
      const req = {
        query: {
          dep_status: "example_status",
          dep_network_id: depNetworkId,
          dep_children: "example_children",
          dep_email: "ignored@example.com",
          user_id: "ignored",
        },
        params: { dep_id: depId },
      };

      const result = generateFilter.departments(req);

      expect(result).to.deep.equal({
        _id: ObjectId(depId),
        net_status: "example_status",
        dep_network_id: ObjectId(depNetworkId),
        dep_children: "example_children",
      });
    });

    it("should call next with an Internal Server Error when dep_id is not a valid ObjectId", function () {
      const next = sinon.stub();
      const req = { query: {}, params: { dep_id: "not-a-valid-id" } };

      const result = generateFilter.departments(req, next);

      expect(result).to.be.undefined;
      expectNextCalledWithInternalServerError(
        next,
        "Argument passed in must be a single String of 12 bytes or a string of 24 hex characters"
      );
    });
  });

  describe("groups", () => {
    it("should generate a filter, wrapping grp_id in an ObjectId", () => {
      const grpId = "507f1f77bcf86cd799439011";
      const req = {
        query: { grp_title: "Group Title", grp_status: "active", category: "category" },
        params: { grp_id: grpId },
      };

      const filter = generateFilter.groups(req);

      expect(filter).to.deep.equal({
        _id: ObjectId(grpId),
        grp_title: "Group Title",
        grp_status: "active",
        category: "category",
      });
    });

    it("should handle missing parameters", () => {
      const req = { query: {}, params: {} };

      const filter = generateFilter.groups(req);

      expect(filter).to.deep.equal({});
    });

    it("should filter by cohort_id when provided", () => {
      const cohortId = "507f1f77bcf86cd799439011";
      const req = { query: { cohort_id: cohortId }, params: {} };

      const filter = generateFilter.groups(req);

      expect(filter).to.deep.equal({ cohorts: ObjectId(cohortId) });
    });

    it("should call next with an Internal Server Error when grp_id is not a valid ObjectId", () => {
      const next = sinon.stub();
      const req = { query: {}, params: { grp_id: "not-a-valid-id" } };

      const filter = generateFilter.groups(req, next);

      expect(filter).to.be.undefined;
      expectNextCalledWithInternalServerError(
        next,
        "Argument passed in must be a single String of 12 bytes or a string of 24 hex characters"
      );
    });
  });

  describe("logs", function () {
    it("should generate a filter for logs with startTime and endTime", function () {
      const req = {
        query: {
          service: "example_service",
          startTime: "2023-07-15T00:00:00.000Z",
          endTime: "2023-07-22T00:00:00.000Z",
          email: "example_email@example.com",
        },
      };

      const result = generateFilter.logs(req);

      expect(result).to.deep.equal({
        timestamp: {
          $gte: new Date("2023-07-15T00:00:00.000Z"),
          $lte: new Date("2023-07-22T00:00:00.000Z"),
        },
        "meta.service": "example_service",
        "meta.email": "example_email@example.com",
      });
    });

    it("should default to a one-week range when neither startTime nor endTime is given", function () {
      const req = { query: {} };

      const result = generateFilter.logs(req);

      expect(result).to.have.property("timestamp");
      expect(result.timestamp).to.have.all.keys("$gte", "$lte");
      expect(result.timestamp.$gte).to.be.a("date");
      expect(result.timestamp.$lte).to.be.a("date");
    });

    it("should call next with an Internal Server Error when email is not a string", function () {
      const next = sinon.stub();
      const req = { query: { email: 12345 } };

      const result = generateFilter.logs(req, next);

      expect(result).to.be.undefined;
      expectNextCalledWithInternalServerError(
        next,
        "email.toLowerCase is not a function"
      );
    });
  });

  describe("preferences", () => {
    // preferences() only recognises user_id and group_id - the old test's
    // grid_id/cohort_id fields do not exist on the real function and were
    // dropped.
    it("should construct a filter object with user_id, wrapped in an ObjectId", () => {
      const userId = "507f1f77bcf86cd799439011";
      const req = { body: {}, query: { user_id: userId }, params: {} };

      const filter = generateFilter.preferences(req);

      expect(filter).to.deep.equal({ user_id: ObjectId(userId) });
    });

    it("should construct a filter object with both user_id and group_id", () => {
      const userId = "507f1f77bcf86cd799439011";
      const groupId = "507f191e810c19729de860ea";
      const req = { body: {}, query: {}, params: { user_id: userId, group_id: groupId } };

      const filter = generateFilter.preferences(req);

      expect(filter).to.deep.equal({
        user_id: ObjectId(userId),
        group_id: ObjectId(groupId),
      });
    });

    it("should call next with an Internal Server Error when user_id is not a valid ObjectId", () => {
      const next = sinon.stub();
      const req = { body: {}, query: { user_id: "not-a-valid-id" }, params: {} };

      const filter = generateFilter.preferences(req, next);

      expect(filter).to.be.undefined;
      expectNextCalledWithInternalServerError(
        next,
        "Argument passed in must be a single String of 12 bytes or a string of 24 hex characters"
      );
    });
  });

  describe("checklists", () => {
    it("should construct a filter object with user_id, wrapped in an ObjectId", () => {
      const userId = "507f1f77bcf86cd799439011";
      const req = { body: {}, query: { user_id: userId }, params: {} };

      const filter = generateFilter.checklists(req);

      expect(filter).to.deep.equal({ user_id: ObjectId(userId) });
    });

    it("should construct a filter object with id, wrapped in an ObjectId", () => {
      const id = "507f1f77bcf86cd799439011";
      const req = { body: {}, query: {}, params: { id } };

      const filter = generateFilter.checklists(req);

      expect(filter).to.deep.equal({ _id: ObjectId(id) });
    });

    it("should fall back to checklist_id when id is absent", () => {
      const checklistId = "507f191e810c19729de860ea";
      const req = { body: {}, query: { checklist_id: checklistId }, params: {} };

      const filter = generateFilter.checklists(req);

      expect(filter).to.deep.equal({ _id: ObjectId(checklistId) });
    });

    it("should construct a filter object with both user_id and id", () => {
      const userId = "507f1f77bcf86cd799439011";
      const id = "507f191e810c19729de860ea";
      const req = { body: {}, query: { user_id: userId }, params: { id } };

      const filter = generateFilter.checklists(req);

      expect(filter).to.deep.equal({ user_id: ObjectId(userId), _id: ObjectId(id) });
    });

    it("should call next with an Internal Server Error when user_id is not a valid ObjectId", () => {
      const next = sinon.stub();
      const req = { body: {}, query: { user_id: "not-a-valid-id" }, params: {} };

      const filter = generateFilter.checklists(req, next);

      expect(filter).to.be.undefined;
      expectNextCalledWithInternalServerError(
        next,
        "Argument passed in must be a single String of 12 bytes or a string of 24 hex characters"
      );
    });
  });
});
