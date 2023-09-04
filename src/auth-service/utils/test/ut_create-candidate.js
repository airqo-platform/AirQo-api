require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const createCandidate = require("@utils/create-candidate");

describe("createCandidate", () => {
  describe("create", () => {
    let fakeUserModel;
    let fakeCandidateModel;
    let fakeMailer;
    let registerStub;
    let sendMailStub;

    beforeEach(() => {
      // Create fake user model and candidate model
      fakeUserModel = {
        exists: () => {},
      };

      fakeCandidateModel = {
        exists: () => {},
        register: () => {},
      };

      // Create a fake mailer object for mocking the candidate function
      fakeMailer = {
        candidate: () => {},
      };

      // Create stubs for the methods to simulate database and email operations
      registerStub = sinon.stub(fakeCandidateModel, "register");
      sendMailStub = sinon.stub(fakeMailer, "candidate");
    });

    afterEach(() => {
      // Restore the stubs after each test
      registerStub.restore();
      sendMailStub.restore();
    });

    it("should create a new candidate and send email successfully", async () => {
      // Arrange
      const req = {
        firstName: "John",
        lastName: "Doe",
        email: "johndoe@example.com",
        tenant: "airqo",
      };

      const candidateData = {
        // Mock candidate data returned from the register function
        // Replace with relevant data for your specific use case
        _id: "mock_candidate_id",
        firstName: "John",
        lastName: "Doe",
        email: "johndoe@example.com",
        // Other candidate data...
      };

      const mailerResponse = {
        success: true,
        message: "email successfully sent",
        status: httpStatus.OK,
      };

      // Set up the fake models and mailer to simulate successful operations
      fakeUserModel.exists.resolves(false); // User does not exist
      fakeCandidateModel.exists.resolves(false); // Candidate does not exist
      registerStub.resolves({ success: true, data: candidateData }); // Registering candidate returns success
      sendMailStub.resolves(mailerResponse); // Sending email returns success

      // Act
      // Replace any necessary parameters for the createCandidate.create function
      const callback = sinon.spy();
      await createCandidate.create(req, callback);

      // Assert
      expect(callback.calledOnce).to.be.true;
      expect(callback.firstCall.args[0]).to.deep.equal({
        success: true,
        message: "candidate successfully created",
        data: candidateData,
        status: httpStatus.OK,
      });
    });

    it("should return candidate already exists message when candidate exists in the system", async () => {
      // Arrange
      const req = {
        firstName: "John",
        lastName: "Doe",
        email: "johndoe@example.com",
        tenant: "airqo",
      };

      // Set up the fake models to simulate that the candidate already exists
      fakeUserModel.exists.resolves(false); // User does not exist
      fakeCandidateModel.exists.resolves(true); // Candidate already exists

      // Act
      const callback = sinon.spy();
      await createCandidate.create(req, callback);

      // Assert
      expect(callback.calledOnce).to.be.true;
      expect(callback.firstCall.args[0]).to.deep.equal({
        success: true,
        message: "candidate already exists",
        status: httpStatus.OK,
      });
    });

    it("should return bad request error when candidate exists as a user in the system", async () => {
      // Arrange
      const req = {
        firstName: "John",
        lastName: "Doe",
        email: "johndoe@example.com",
        tenant: "airqo",
      };

      // Set up the fake models to simulate that the candidate exists as a user
      fakeUserModel.exists.resolves(true); // User already exists

      // Act
      const callback = sinon.spy();
      await createCandidate.create(req, callback);

      // Assert
      expect(callback.calledOnce).to.be.true;
      expect(callback.firstCall.args[0]).to.deep.equal({
        success: false,
        message: "Bad Request Error",
        status: httpStatus.BAD_REQUEST,
        errors: {
          message:
            "Candidate already exists as a User,you can use the FORGOT PASSWORD feature",
        },
      });
    });

    it("should return internal server error when candidate registration fails", async () => {
      // Arrange
      const req = {
        firstName: "John",
        lastName: "Doe",
        email: "johndoe@example.com",
        tenant: "airqo",
      };

      // Set up the fake models to simulate that the candidate does not exist and registration fails
      fakeUserModel.exists.resolves(false); // User does not exist
      registerStub.resolves({
        success: false,
        message: "Failed to register candidate",
      }); // Registering candidate fails

      // Act
      const callback = sinon.spy();
      await createCandidate.create(req, callback);

      // Assert
      expect(callback.calledOnce).to.be.true;
      expect(callback.firstCall.args[0]).to.deep.equal({
        success: false,
        message: "Failed to register candidate",
      });
    });

    it("should return internal server error when sending email fails", async () => {
      // Arrange
      const req = {
        firstName: "John",
        lastName: "Doe",
        email: "johndoe@example.com",
        tenant: "airqo",
      };

      const candidateData = {
        // Mock candidate data returned from the register function
        // Replace with relevant data for your specific use case
        _id: "mock_candidate_id",
        firstName: "John",
        lastName: "Doe",
        email: "johndoe@example.com",
        // Other candidate data...
      };

      // Set up the fake models and mailer to simulate successful registration but email sending fails
      fakeUserModel.exists.resolves(false); // User does not exist
      fakeCandidateModel.exists.resolves(false); // Candidate does not exist
      registerStub.resolves({ success: true, data: candidateData }); // Registering candidate returns success
      sendMailStub.resolves({
        success: false,
        message: "Failed to send email",
      }); // Sending email fails

      // Act
      const callback = sinon.spy();
      await createCandidate.create(req, callback);

      // Assert
      expect(callback.calledOnce).to.be.true;
      expect(callback.firstCall.args[0]).to.deep.equal({
        success: false,
        message: "Failed to send email",
      });
    });

    // Add more tests for other scenarios...
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
