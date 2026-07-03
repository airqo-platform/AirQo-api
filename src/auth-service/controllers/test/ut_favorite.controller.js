require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const rewire = require("rewire");
const createFavoriteUtil = require("@utils/favorite.util");

const createFavorite = rewire("@controllers/favorite.controller");
const realExtractErrors = require("@utils/shared").extractErrorsFromRequest;
const mockBadRequest = () => [{ param: "key", message: "required" }];

describe("createFavorite module", () => {
  let req, res, next;

  beforeEach(() => {
    req = { query: { tenant: "airqo" }, body: {}, params: {} };
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub(),
      headersSent: false,
    };
    next = sinon.stub();
  });

  afterEach(() => {
    sinon.restore();
    createFavorite.__set__("extractErrorsFromRequest", realExtractErrors);
  });

  describe("syncFavorites()", () => {
    it("should return a bad request response if there are validation errors", async () => {
      createFavorite.__set__("extractErrorsFromRequest", mockBadRequest);

      await createFavorite.syncFavorites(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should return an internal server error response if an error occurs in createFavoriteUtil.syncFavorites", async () => {
      sinon.stub(createFavoriteUtil, "syncFavorites").rejects(new Error("Sync error"));

      await createFavorite.syncFavorites(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });

    it("should return a success response with data if createFavoriteUtil.syncFavorites is successful", async () => {
      sinon.stub(createFavoriteUtil, "syncFavorites").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Favorites synced",
        data: [{ place: "home" }],
      });

      await createFavorite.syncFavorites(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, favorites: sinon.match.array })).to.be.true;
    });

    it("should return an error response if createFavoriteUtil.syncFavorites is unsuccessful", async () => {
      sinon.stub(createFavoriteUtil, "syncFavorites").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Sync failed",
        errors: { message: "Error" },
      });

      await createFavorite.syncFavorites(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });
  });

  describe("create()", () => {
    it("should return a bad request response if there are validation errors", async () => {
      createFavorite.__set__("extractErrorsFromRequest", mockBadRequest);

      await createFavorite.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should return an internal server error response if an error occurs in createFavoriteUtil.create", async () => {
      sinon.stub(createFavoriteUtil, "create").rejects(new Error("Create error"));

      await createFavorite.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });

    it("should return a success response with data if createFavoriteUtil.create is successful", async () => {
      sinon.stub(createFavoriteUtil, "create").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Favorite created",
        data: { place: "home" },
      });

      await createFavorite.create(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, created_Favorite: { place: "home" } })).to.be.true;
    });

    it("should return an error response if createFavoriteUtil.create is unsuccessful", async () => {
      sinon.stub(createFavoriteUtil, "create").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Create failed",
        errors: { message: "Error" },
      });

      await createFavorite.create(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });
  });

  describe("list()", () => {
    it("should return a bad request response if there are validation errors", async () => {
      createFavorite.__set__("extractErrorsFromRequest", mockBadRequest);

      await createFavorite.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should return an internal server error response if an error occurs in createFavoriteUtil.list", async () => {
      sinon.stub(createFavoriteUtil, "list").rejects(new Error("List error"));

      await createFavorite.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });

    it("should return a success response with data if createFavoriteUtil.list is successful", async () => {
      sinon.stub(createFavoriteUtil, "list").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Favorites listed",
        data: [{ place: "home" }],
      });

      await createFavorite.list(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, favorites: sinon.match.array })).to.be.true;
    });

    it("should return an error response if createFavoriteUtil.list is unsuccessful", async () => {
      sinon.stub(createFavoriteUtil, "list").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "List failed",
        errors: { message: "Error" },
      });

      await createFavorite.list(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });
  });

  describe("delete()", () => {
    it("should return a bad request response if there are validation errors", async () => {
      createFavorite.__set__("extractErrorsFromRequest", mockBadRequest);

      await createFavorite.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should return an internal server error response if an error occurs in createFavoriteUtil.delete", async () => {
      sinon.stub(createFavoriteUtil, "delete").rejects(new Error("Delete error"));

      await createFavorite.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });

    it("should return a success response with data if createFavoriteUtil.delete is successful", async () => {
      sinon.stub(createFavoriteUtil, "delete").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Favorite deleted",
        data: { place: "home" },
      });

      await createFavorite.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, deleted_Favorite: { place: "home" } })).to.be.true;
    });

    it("should return an error response if createFavoriteUtil.delete is unsuccessful", async () => {
      sinon.stub(createFavoriteUtil, "delete").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Delete failed",
        errors: { message: "Error" },
      });

      await createFavorite.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });
  });

  describe("update()", () => {
    it("should return a bad request response if there are validation errors", async () => {
      createFavorite.__set__("extractErrorsFromRequest", mockBadRequest);

      await createFavorite.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should return an internal server error response if an error occurs in createFavoriteUtil.update", async () => {
      sinon.stub(createFavoriteUtil, "update").rejects(new Error("Update error"));

      await createFavorite.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });

    it("should return a success response with data if createFavoriteUtil.update is successful", async () => {
      sinon.stub(createFavoriteUtil, "update").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Favorite updated",
        data: { place: "work" },
      });

      await createFavorite.update(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, updated_Favorite: { place: "work" } })).to.be.true;
    });

    it("should return an error response if createFavoriteUtil.update is unsuccessful", async () => {
      sinon.stub(createFavoriteUtil, "update").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Update failed",
        errors: { message: "Error" },
      });

      await createFavorite.update(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });
  });
});
