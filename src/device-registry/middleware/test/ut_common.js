require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const middleware = require("@middleware/common");

describe("Middleware", () => {
  describe("validatePagination", () => {
    it("should set default limit if not provided", () => {
      const req = { query: {} };
      const res = {};
      const next = sinon.spy();

      middleware.validatePagination(req, res, next);

      expect(req.query.limit).to.equal(1000);
      expect(next.calledOnce).to.be.true;
    });

    it("should set limit to 2000 if provided limit is greater", () => {
      const req = { query: { limit: "3000" } };
      const res = {};
      const next = sinon.spy();

      middleware.validatePagination(req, res, next);

      expect(req.query.limit).to.equal(2000);
      expect(next.calledOnce).to.be.true;
    });

    it("should set skip to 0 if not provided or invalid", () => {
      const req = { query: { skip: "invalid" } };
      const res = {};
      const next = sinon.spy();

      middleware.validatePagination(req, res, next);

      expect(req.query.skip).to.equal(0);
      expect(next.calledOnce).to.be.true;
    });

    it("should not modify valid limit and skip values", () => {
      const req = { query: { limit: "500", skip: "100" } };
      const res = {};
      const next = sinon.spy();

      middleware.validatePagination(req, res, next);

      expect(req.query.limit).to.equal(500);
      expect(req.query.skip).to.equal(100);
      expect(next.calledOnce).to.be.true;
    });
  });

  describe("headers", () => {
    it("should set the correct headers", () => {
      const req = {};
      const res = {
        setHeader: sinon.spy(),
        header: sinon.spy(),
      };
      const next = sinon.spy();

      middleware.headers(req, res, next);

      expect(res.setHeader.calledWith("Access-Control-Allow-Origin", "*")).to.be
        .true;
      expect(
        res.header.calledWith(
          "Access-Control-Allow-Headers",
          "Origin, X-Requested-With, Content-Type, Accept, Authorization"
        )
      ).to.be.true;
      expect(
        res.header.calledWith(
          "Access-Control-Allow-Methods",
          "GET, POST, PUT, DELETE"
        )
      ).to.be.true;
      expect(next.calledOnce).to.be.true;
    });
  });
});
