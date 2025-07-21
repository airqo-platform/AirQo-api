const sinon = require("sinon");
const chai = require("chai");
const chaiHttp = require("chai-http");
const expect = chai.expect;
const SearchController = require("./search.controller");

describe("SearchController", () => {
  let mockRequest;
  let mockResponse;
  let mockNext;
  let mockSearchUtil;
  let mockLogger;

  beforeEach(() => {
    mockRequest = {
      query: {},
      body: {},
      params: {},
    };
    mockResponse = {
      status: sinon.spy(),
      json: sinon.spy(),
    };
    mockNext = sinon.spy();
    mockSearchUtil = {
      search: sinon
        .stub()
        .resolves({
          success: true,
          status: 200,
          message: "Search successful",
          data: [],
        }),
      autocomplete: sinon
        .stub()
        .resolves({
          success: true,
          status: 200,
          message: "Autocomplete successful",
          data: [],
        }),
      filter: sinon
        .stub()
        .resolves({
          success: true,
          status: 200,
          message: "Filter successful",
          data: [],
        }),
      paginate: sinon
        .stub()
        .resolves({
          success: true,
          status: 200,
          message: "Paginate successful",
          data: [],
        }),
    };
    mockLogger = {
      error: sinon.spy(),
    };

    sinon.replace(SearchController, "searchUtil", mockSearchUtil);
    sinon.replace(SearchController, "logger", mockLogger);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("search", () => {
    it("should handle successful search", async () => {
      mockRequest.query.q = "test query";

      await SearchController.search(mockRequest, mockResponse, mockNext);

      expect(mockSearchUtil.search).toHaveBeenCalledWith(
        "test query",
        mockRequest,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: "Search successful",
        searchResults: [],
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [
        { field: "requiredField", message: "Required field is missing" },
      ];
      sinon
        .stub(SearchController.extractErrorsFromRequest, "default")
        .returns(errors);

      await SearchController.search(mockRequest, mockResponse, mockNext);

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockSearchUtil.search.resolves({});

      await SearchController.search(mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("autocomplete", () => {
    it("should handle successful autocomplete", async () => {
      mockRequest.query.q = "test autocomplete";

      await SearchController.autocomplete(mockRequest, mockResponse, mockNext);

      expect(mockSearchUtil.autocomplete).toHaveBeenCalledWith(
        "test autocomplete",
        mockRequest,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: "Autocomplete successful",
        autocompleteResults: [],
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [
        { field: "requiredField", message: "Required field is missing" },
      ];
      sinon
        .stub(SearchController.extractErrorsFromRequest, "default")
        .returns(errors);

      await SearchController.autocomplete(mockRequest, mockResponse, mockNext);

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockSearchUtil.autocomplete.resolves({});

      await SearchController.autocomplete(mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("filter", () => {
    it("should handle successful filter", async () => {
      mockRequest.query.q = "test filter";

      await SearchController.filter(mockRequest, mockResponse, mockNext);

      expect(mockSearchUtil.filter).toHaveBeenCalledWith(
        "test filter",
        mockRequest,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: "Filter successful",
        filteredResults: [],
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [
        { field: "requiredField", message: "Required field is missing" },
      ];
      sinon
        .stub(SearchController.extractErrorsFromRequest, "default")
        .returns(errors);

      await SearchController.filter(mockRequest, mockResponse, mockNext);

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockSearchUtil.filter.resolves({});

      await SearchController.filter(mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("paginate", () => {
    it("should handle successful pagination", async () => {
      mockRequest.query.q = "test paginate";

      await SearchController.paginate(mockRequest, mockResponse, mockNext);

      expect(mockSearchUtil.paginate).toHaveBeenCalledWith(
        "test paginate",
        mockRequest,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: "Paginate successful",
        paginatedResults: [],
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [
        { field: "requiredField", message: "Required field is missing" },
      ];
      sinon
        .stub(SearchController.extractErrorsFromRequest, "default")
        .returns(errors);

      await SearchController.paginate(mockRequest, mockResponse, mockNext);

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockSearchUtil.paginate.resolves({});

      await SearchController.paginate(mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).not.to.have.been.called;
    });
  });
});
