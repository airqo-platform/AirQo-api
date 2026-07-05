require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const rewire = require("rewire");
const httpStatus = require("http-status");

const rewireDept = rewire("@utils/department.util");

describe("department util", () => {
  let req, next;
  let origDepartmentModel, origGenerateFilter;

  beforeEach(() => {
    req = {
      body: { dep_title: "Engineering", dep_status: "active" },
      query: { tenant: "airqo", limit: 10, skip: 0 },
      params: {},
    };
    next = sinon.stub();

    origDepartmentModel = rewireDept.__get__("DepartmentModel");
    origGenerateFilter = rewireDept.__get__("generateFilter");
  });

  afterEach(() => {
    rewireDept.__set__("DepartmentModel", origDepartmentModel);
    rewireDept.__set__("generateFilter", origGenerateFilter);
    sinon.restore();
  });

  describe("createDepartment()", () => {
    it("should create a department and return success", async () => {
      rewireDept.__set__("DepartmentModel", () => ({
        register: sinon.stub().resolves({
          success: true,
          status: httpStatus.OK,
          message: "department created",
          data: { dep_title: "Engineering" },
        }),
      }));

      const result = await rewireDept.createDepartment(req, next);

      expect(result.success).to.equal(true);
      expect(result.message).to.equal("department created");
    });

    it("should call next with HttpError when register throws", async () => {
      rewireDept.__set__("DepartmentModel", () => ({
        register: sinon.stub().throws(new Error("unexpected")),
      }));

      await rewireDept.createDepartment(req, next);

      expect(next.calledOnce).to.equal(true);
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("updateDepartment()", () => {
    it("should update a department and return success", async () => {
      rewireDept.__set__("generateFilter", {
        ...origGenerateFilter,
        departments: sinon.stub().returns({ dep_title: "Engineering" }),
      });
      rewireDept.__set__("DepartmentModel", () => ({
        modify: sinon.stub().resolves({
          success: true,
          status: httpStatus.OK,
          message: "successfully modified the department",
          data: { dep_title: "Engineering", dep_status: "inactive" },
        }),
      }));

      req.body = { dep_status: "inactive" };
      const result = await rewireDept.updateDepartment(req, next);

      expect(result.success).to.equal(true);
    });

    it("should call next when modify throws", async () => {
      rewireDept.__set__("generateFilter", {
        ...origGenerateFilter,
        departments: sinon.stub().returns({}),
      });
      rewireDept.__set__("DepartmentModel", () => ({
        modify: sinon.stub().throws(new Error("DB failure")),
      }));

      await rewireDept.updateDepartment(req, next);

      expect(next.calledOnce).to.equal(true);
    });
  });

  describe("deleteDepartment()", () => {
    it("should delete a department and return success", async () => {
      rewireDept.__set__("generateFilter", {
        ...origGenerateFilter,
        departments: sinon.stub().returns({ dep_title: "Engineering" }),
      });
      rewireDept.__set__("DepartmentModel", () => ({
        remove: sinon.stub().resolves({
          success: true,
          status: httpStatus.OK,
          message: "successfully removed the department",
          data: { dep_title: "Engineering" },
        }),
      }));

      const result = await rewireDept.deleteDepartment(req, next);

      expect(result.success).to.equal(true);
    });

    it("should call next when remove throws", async () => {
      rewireDept.__set__("generateFilter", {
        ...origGenerateFilter,
        departments: sinon.stub().returns({}),
      });
      rewireDept.__set__("DepartmentModel", () => ({
        remove: sinon.stub().throws(new Error("DB failure")),
      }));

      await rewireDept.deleteDepartment(req, next);

      expect(next.calledOnce).to.equal(true);
    });
  });

  describe("listDepartment()", () => {
    it("should list departments and return success", async () => {
      rewireDept.__set__("generateFilter", {
        ...origGenerateFilter,
        departments: sinon.stub().returns({}),
      });
      rewireDept.__set__("DepartmentModel", () => ({
        list: sinon.stub().resolves({
          success: true,
          status: httpStatus.OK,
          message: "departments listed",
          data: [{ dep_title: "Engineering" }],
        }),
      }));

      const result = await rewireDept.listDepartment(req, next);

      expect(result.success).to.equal(true);
      expect(result.data).to.be.an("array");
    });

    it("should call next when list throws", async () => {
      rewireDept.__set__("generateFilter", {
        ...origGenerateFilter,
        departments: sinon.stub().returns({}),
      });
      rewireDept.__set__("DepartmentModel", () => ({
        list: sinon.stub().throws(new Error("DB failure")),
      }));

      await rewireDept.listDepartment(req, next);

      expect(next.calledOnce).to.equal(true);
    });
  });
});
