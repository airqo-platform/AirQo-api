require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const createCandidate = require("@utils/create-candidate");
const UserModel = require("@models/User");
const CandidateModel = require("@models/Candidate");
const NetworkModel = require("@models/Network");
const mailer = require("@utils/mailer");

describe("createCandidate", () => {
  describe("create()", () => {
    let req,
      validationResultStub,
      UserModelStub,
      CandidateModelStub,
      NetworkModelStub,
      mailerStub;

    beforeEach(() => {
      req = {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        tenant: "sample-tenant",
        network_id: "sample-network-id",
      };

      validationResultStub = sinon.stub();
      UserModelStub = sinon.stub(UserModel(sampleTenant), "exists");
      CandidateModelStub = sinon.stub(CandidateModel(sampleTenant), "exists");
      NetworkModelStub = sinon.stub(NetworkModel(sampleTenant), "exists");
      mailerStub = sinon.stub(mailer, "candidate");
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should return success when everything is fine and candidate does not exist", async () => {
      validationResultStub.returns(true);
      UserModelStub.resolves(false);
      CandidateModelStub.resolves(false);
      NetworkModelStub.resolves(true);
      CandidateModelStub.resolves({
        success: true,
        data: {
          // Sample candidate data
        },
      });
      mailerStub.resolves({
        success: true,
        status: 200,
      });

      const result = await createCandidate.create(req);

      expect(result).to.deep.equal({
        success: true,
        message: "candidate successfully created",
        data: {},
        status: 200,
      });
    });

    it("should return success when everything is fine and candidate exists", async () => {
      validationResultStub.returns(true);
      UserModelStub.resolves(false);
      CandidateModelStub.resolves(true);

      const result = await createCandidate.create(req);

      expect(result).to.deep.equal({
        success: true,
        message: "candidate already exists",
        status: 200,
      });
    });

    it("should return bad request when network does not exist", async () => {
      validationResultStub.returns(true);
      UserModelStub.resolves(false);
      CandidateModelStub.resolves(false);
      NetworkModelStub.resolves(false);

      const result = await createCandidate.create(req);

      expect(result).to.deep.equal({
        success: false,
        message: "the provided network does not exist",
        status: 400,
        errors: { message: "Network sample-network-id not found" },
      });
    });

    // Add more test cases for other scenarios (e.g., user exists, mailer fails, exceptions)
  });
  describe("list", () => {
    let fakeCandidateModel;
    let fakeGenerateFilter;

    beforeEach(() => {
      // Create a fake candidate model
      fakeCandidateModel = {
        list: () => {},
      };

      // Create a fake generateFilter object for mocking the candidates function
      fakeGenerateFilter = {
        candidates: () => {},
      };
    });

    it("should return a list of candidates", async () => {
      // Arrange
      const request = {
        query: {
          tenant: "airqo",
          limit: "10",
          skip: "0",
          // Other query parameters...
        },
      };

      const generatedFilter = {
        // Mock generated filter data returned from generateFilter.candidates
        // Replace with relevant data for your specific use case
        field1: "value1",
        field2: "value2",
        // Other filter fields...
      };

      const candidateList = [
        {
          // Mock candidate data returned from the list function
          // Replace with relevant data for your specific use case
          _id: "candidate_id_1",
          firstName: "John",
          lastName: "Doe",
          email: "johndoe@example.com",
          // Other candidate data...
        },
        {
          _id: "candidate_id_2",
          firstName: "Jane",
          lastName: "Smith",
          email: "janesmith@example.com",
          // Other candidate data...
        },
        // Other candidates...
      ];

      // Set up the fake generateFilter to simulate successful generation of the filter
      fakeGenerateFilter.candidates.returns({
        success: true,
        data: generatedFilter,
      });

      // Set up the fake candidate model to simulate successful list operation
      fakeCandidateModel.list.resolves(candidateList);

      // Act
      const result = await createCandidate.list(request);

      // Assert
      expect(fakeGenerateFilter.candidates.calledOnce).to.be.true;
      expect(fakeGenerateFilter.candidates.firstCall.args[0]).to.deep.equal(
        request
      );

      expect(fakeCandidateModel.list.calledOnce).to.be.true;
      expect(fakeCandidateModel.list.firstCall.args[0]).to.deep.equal({
        filter: generatedFilter,
        limit: 10,
        skip: 0,
      });

      expect(result).to.deep.equal(candidateList);
    });

    it("should return the error response from generateFilter.candidates", async () => {
      // Arrange
      const request = {
        query: {
          tenant: "airqo",
          limit: "10",
          skip: "0",
          // Other query parameters...
        },
      };

      const filterErrorResponse = {
        success: false,
        message: "Invalid query parameters",
        status: httpStatus.BAD_REQUEST,
        errors: {
          message: "Invalid query parameters",
        },
      };

      // Set up the fake generateFilter to simulate a filter error
      fakeGenerateFilter.candidates.returns(filterErrorResponse);

      // Act
      const result = await createCandidate.list(request);

      // Assert
      expect(fakeGenerateFilter.candidates.calledOnce).to.be.true;
      expect(fakeGenerateFilter.candidates.firstCall.args[0]).to.deep.equal(
        request
      );

      expect(result).to.deep.equal(filterErrorResponse);
    });

    it("should return an error response when candidate listing fails", async () => {
      // Arrange
      const request = {
        query: {
          tenant: "airqo",
          limit: "10",
          skip: "0",
          // Other query parameters...
        },
      };

      const generatedFilter = {
        // Mock generated filter data returned from generateFilter.candidates
        // Replace with relevant data for your specific use case
        field1: "value1",
        field2: "value2",
        // Other filter fields...
      };

      // Set up the fake generateFilter to simulate successful generation of the filter
      fakeGenerateFilter.candidates.returns({
        success: true,
        data: generatedFilter,
      });

      // Set up the fake candidate model to simulate candidate listing failure
      fakeCandidateModel.list.rejects(new Error("Database error"));

      // Act
      const result = await createCandidate.list(request);

      // Assert
      expect(fakeGenerateFilter.candidates.calledOnce).to.be.true;
      expect(fakeGenerateFilter.candidates.firstCall.args[0]).to.deep.equal(
        request
      );

      expect(fakeCandidateModel.list.calledOnce).to.be.true;
      expect(fakeCandidateModel.list.firstCall.args[0]).to.deep.equal({
        filter: generatedFilter,
        limit: 10,
        skip: 0,
      });

      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        error: "Database error",
        errors: { message: "Database error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    // Add more tests for other scenarios...
  });
  describe("update", () => {
    let fakeCandidateModel;
    let fakeGenerateFilter;

    beforeEach(() => {
      // Create a fake candidate model
      fakeCandidateModel = {
        modify: () => {},
      };

      // Create a fake generateFilter object for mocking the candidates function
      fakeGenerateFilter = {
        candidates: () => {},
      };
    });

    it("should update a candidate and return the updated candidate", async () => {
      // Arrange
      const request = {
        query: {
          tenant: "airqo",
          // Other query parameters...
        },
        body: {
          // Mock update data
          firstName: "UpdatedFirstName",
          lastName: "UpdatedLastName",
          // Other update data...
        },
      };

      const generatedFilter = {
        // Mock generated filter data returned from generateFilter.candidates
        // Replace with relevant data for your specific use case
        field1: "value1",
        field2: "value2",
        // Other filter fields...
      };

      const updatedCandidate = {
        // Mock updated candidate data returned from the modify function
        // Replace with relevant data for your specific use case
        _id: "candidate_id_1",
        firstName: "UpdatedFirstName",
        lastName: "UpdatedLastName",
        email: "johndoe@example.com",
        // Other candidate data...
      };

      // Set up the fake generateFilter to simulate successful generation of the filter
      fakeGenerateFilter.candidates.returns({
        success: true,
        data: generatedFilter,
      });

      // Set up the fake candidate model to simulate successful candidate modification
      fakeCandidateModel.modify.resolves(updatedCandidate);

      // Act
      const result = await createCandidate.update(request);

      // Assert
      expect(fakeGenerateFilter.candidates.calledOnce).to.be.true;
      expect(fakeGenerateFilter.candidates.firstCall.args[0]).to.deep.equal(
        request
      );

      expect(fakeCandidateModel.modify.calledOnce).to.be.true;
      expect(fakeCandidateModel.modify.firstCall.args[0]).to.deep.equal({
        filter: generatedFilter,
        update: request.body,
      });

      expect(result).to.deep.equal(updatedCandidate);
    });

    it("should return the error response from generateFilter.candidates", async () => {
      // Arrange
      const request = {
        query: {
          tenant: "airqo",
          // Other query parameters...
        },
        body: {
          // Mock update data
          firstName: "UpdatedFirstName",
          lastName: "UpdatedLastName",
          // Other update data...
        },
      };

      const filterErrorResponse = {
        success: false,
        message: "Invalid query parameters",
        status: httpStatus.BAD_REQUEST,
        errors: {
          message: "Invalid query parameters",
        },
      };

      // Set up the fake generateFilter to simulate a filter error
      fakeGenerateFilter.candidates.returns(filterErrorResponse);

      // Act
      const result = await createCandidate.update(request);

      // Assert
      expect(fakeGenerateFilter.candidates.calledOnce).to.be.true;
      expect(fakeGenerateFilter.candidates.firstCall.args[0]).to.deep.equal(
        request
      );

      expect(result).to.deep.equal(filterErrorResponse);
    });

    it("should return an error response when candidate modification fails", async () => {
      // Arrange
      const request = {
        query: {
          tenant: "airqo",
          // Other query parameters...
        },
        body: {
          // Mock update data
          firstName: "UpdatedFirstName",
          lastName: "UpdatedLastName",
          // Other update data...
        },
      };

      const generatedFilter = {
        // Mock generated filter data returned from generateFilter.candidates
        // Replace with relevant data for your specific use case
        field1: "value1",
        field2: "value2",
        // Other filter fields...
      };

      // Set up the fake generateFilter to simulate successful generation of the filter
      fakeGenerateFilter.candidates.returns({
        success: true,
        data: generatedFilter,
      });

      // Set up the fake candidate model to simulate candidate modification failure
      fakeCandidateModel.modify.rejects(new Error("Database error"));

      // Act
      const result = await createCandidate.update(request);

      // Assert
      expect(fakeGenerateFilter.candidates.calledOnce).to.be.true;
      expect(fakeGenerateFilter.candidates.firstCall.args[0]).to.deep.equal(
        request
      );

      expect(fakeCandidateModel.modify.calledOnce).to.be.true;
      expect(fakeCandidateModel.modify.firstCall.args[0]).to.deep.equal({
        filter: generatedFilter,
        update: request.body,
      });

      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        error: "Database error",
        errors: { message: "Database error" },
      });
    });

    // Add more tests for other scenarios...
  });
  describe("confirm", () => {
    let fakeCandidateModel;
    let fakeUserModel;
    let fakeMailer;

    beforeEach(() => {
      // Create a fake candidate model
      fakeCandidateModel = {
        exists: () => {},
        find: () => {},
        remove: () => {},
      };

      // Create a fake user model
      fakeUserModel = {
        exists: () => {},
        register: () => {},
      };

      // Create a fake mailer
      fakeMailer = {
        user: () => {},
      };
    });

    it("should confirm a candidate, create a user, send email, and remove the candidate", async () => {
      // Arrange
      const req = {
        tenant: "airqo",
        firstName: "John",
        lastName: "Doe",
        email: "johndoe@example.com",
        // Other request data...
      };

      const candidateExists = true;
      const userExists = false;

      const candidateDetails = [
        {
          _id: "candidate_id_1",
          firstName: "John",
          lastName: "Doe",
          email: "johndoe@example.com",
          // Other candidate data...
        },
      ];

      const password = "generatedPassword";

      const requestBodyForUserCreation = {
        ...req,
        privilege: "user",
        userName: "johndoe@example.com",
        password: password,
      };

      const createUserResponse = {
        success: true,
        data: {
          _id: "user_id_1",
          firstName: "John",
          lastName: "Doe",
          email: "johndoe@example.com",
          userName: "johndoe@example.com",
          // Other user data...
        },
      };

      const sendEmailResponse = {
        success: true,
        status: httpStatus.OK,
        // Other email response data...
      };

      const removeCandidateResponse = {
        success: true,
        // Other remove candidate response data...
      };

      // Set up the fake candidate model to simulate the candidate exists
      fakeCandidateModel.exists.resolves(candidateExists);
      fakeCandidateModel.find.resolves(candidateDetails);
      fakeCandidateModel.remove.resolves(removeCandidateResponse);

      // Set up the fake user model to simulate the user does not exist and user creation
      fakeUserModel.exists.resolves(userExists);
      fakeUserModel.register.resolves(createUserResponse);

      // Set up the fake mailer to simulate successful email sending
      fakeMailer.user.resolves(sendEmailResponse);

      // Act
      const result = await createCandidate.confirm(req);

      // Assert
      expect(fakeCandidateModel.exists.calledOnce).to.be.true;
      expect(fakeCandidateModel.exists.firstCall.args[0]).to.deep.equal({
        email: req.email,
      });

      expect(fakeUserModel.exists.calledOnce).to.be.true;
      expect(fakeUserModel.exists.firstCall.args[0]).to.deep.equal({
        email: req.email,
      });

      expect(fakeCandidateModel.find.calledOnce).to.be.true;
      expect(fakeCandidateModel.find.firstCall.args[0]).to.deep.equal({
        email: req.email,
      });

      expect(fakeUserModel.register.calledOnce).to.be.true;
      expect(fakeUserModel.register.firstCall.args[0]).to.deep.equal(
        requestBodyForUserCreation
      );

      expect(fakeMailer.user.calledOnce).to.be.true;
      expect(fakeMailer.user.firstCall.args).to.deep.equal([
        req.firstName,
        req.lastName,
        req.email,
        password,
        req.tenant,
        "confirm",
      ]);

      expect(fakeCandidateModel.remove.calledOnce).to.be.true;
      expect(fakeCandidateModel.remove.firstCall.args[0]).to.deep.equal({
        _id: candidateDetails[0]._id,
      });

      expect(result).to.deep.equal({
        success: true,
        message: "candidate successfully confirmed",
        data: {
          firstName: req.firstName,
          lastName: req.lastName,
          email: req.email,
          userName: req.email,
        },
        status: httpStatus.OK,
      });
    });

    // Add more tests for other scenarios...
  });
  describe("delete", () => {
    let fakeCandidateModel;

    beforeEach(() => {
      // Create a fake candidate model
      fakeCandidateModel = {
        remove: () => {},
      };
    });

    it("should remove a candidate", async () => {
      // Arrange
      const request = {
        query: {
          tenant: "airqo",
        },
        // Other request data...
      };

      const candidateId = "candidate_id_1";

      const responseFromFilter = {
        success: true,
        data: {
          _id: candidateId,
          // Other candidate filter data...
        },
      };

      const removeCandidateResponse = {
        success: true,
        // Other remove candidate response data...
      };

      // Set up the fake candidate model to simulate successful removal
      fakeCandidateModel.remove.resolves(removeCandidateResponse);

      // Stub the `generateFilter.candidates` function to return the response with candidate filter
      sinon.stub(generateFilter, "candidates").returns(responseFromFilter);

      // Act
      const result = await createCandidate.delete(request);

      // Assert
      expect(generateFilter.candidates.calledOnce).to.be.true;
      expect(generateFilter.candidates.firstCall.args[0]).to.deep.equal(
        request
      );

      expect(fakeCandidateModel.remove.calledOnce).to.be.true;
      expect(fakeCandidateModel.remove.firstCall.args[0]).to.deep.equal({
        filter: responseFromFilter.data,
      });

      expect(result).to.deep.equal(removeCandidateResponse);
    });

    // Add more tests for other scenarios...
  });
});
