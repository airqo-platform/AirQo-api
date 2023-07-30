require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const ClientSchema = require("@models/Client");
const mongoose = require("mongoose");

describe("ClientSchema - Statics", () => {
  describe("Method: register", () => {
    it("should register a new client with valid arguments", async () => {
      // Mock valid arguments for a new client
      const args = {
        client_id: "test_client_id",
        client_secret: "test_client_secret",
        name: "Test Client",
        redirect_uri: "https://example.com/callback",
      };

      // Call the register method
      const result = await ClientSchema.register(args);

      // Assertions
      expect(result.success).to.be.true;
      expect(result.data).to.be.an("object").that.includes(args);
      expect(result.message).to.equal("client created");
      // Add more assertions to verify the result
    });

    it("should return validation errors for duplicate client_id", async () => {
      // Mock an existing client with the same client_id
      const existingClient = new ClientSchema({
        client_id: "test_client_id",
        client_secret: "test_secret",
        name: "Existing Client",
      });
      await existingClient.save();

      // Mock arguments with duplicate client_id
      const args = {
        client_id: "test_client_id",
        client_secret: "new_secret",
        name: "New Client",
      };

      // Call the register method
      const result = await ClientSchema.register(args);

      // Assertions
      expect(result.success).to.be.false;
      expect(result.errors).to.deep.equal({
        client_id: "the client_id must be unique",
        message: "the client_id must be unique for every client",
      });
      expect(result.status).to.equal(httpStatus.CONFLICT);
      // Add more assertions to verify the result
    });

    // Add more test cases to cover additional scenarios if needed
  });

  describe("Method: list", () => {
    it("should return a list of clients with valid filter", async () => {
      // Mock an array of clients
      const mockClients = [
        {
          client_id: "test_client_1",
          client_secret: "test_secret_1",
          name: "Test Client 1",
          redirect_uri: "https://example.com/callback1",
        },
        {
          client_id: "test_client_2",
          client_secret: "test_secret_2",
          name: "Test Client 2",
          redirect_uri: "https://example.com/callback2",
        },
        // Add more mock clients if needed
      ];
      await ClientSchema.insertMany(mockClients);

      // Mock the input filter
      const filter = { name: "Test Client" };

      // Call the list method
      const result = await ClientSchema.list({ filter });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.data).to.be.an("array").that.has.lengthOf.at.least(1);
      // Add more assertions to verify the result
    });

    it("should return empty list when no clients match the filter", async () => {
      // Mock the input filter with no matching clients
      const filter = { name: "Nonexistent Client" };

      // Call the list method
      const result = await ClientSchema.list({ filter });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.data).to.be.an("array").that.is.empty;
      // Add more assertions to verify the result
    });

    // Add more test cases to cover additional scenarios if needed
  });

  describe("Method: modify", () => {
    it("should modify an existing client with valid filter and update", async () => {
      // Mock an existing client
      const existingClient = new ClientSchema({
        client_id: "test_client_id",
        client_secret: "test_secret",
        name: "Test Client",
      });
      await existingClient.save();

      // Mock the input filter and update
      const filter = { client_id: "test_client_id" };
      const update = { redirect_uri: "https://example.com/updated" };

      // Call the modify method
      const result = await ClientSchema.modify({ filter, update });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.data).to.be.an("object").that.includes(update);
      expect(result.message).to.equal("successfully modified the client");
      // Add more assertions to verify the result
    });

    it("should return an error when client does not exist", async () => {
      // Mock the input filter with non-existing client
      const filter = { client_id: "nonexistent_client" };

      // Mock the input update
      const update = { name: "Updated Name" };

      // Call the modify method
      const result = await ClientSchema.modify({ filter, update });

      // Assertions
      expect(result.success).to.be.false;
      expect(result.errors).to.deep.equal({
        message: "client does not exist, please crosscheck",
      });
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
      // Add more assertions to verify the result
    });

    // Add more test cases to cover additional scenarios if needed
  });

  describe("Method: remove", () => {
    it("should remove an existing client with valid filter", async () => {
      // Mock an existing client
      const existingClient = new ClientSchema({
        client_id: "test_client_id",
        client_secret: "test_secret",
        name: "Test Client",
      });
      await existingClient.save();

      // Mock the input filter
      const filter = { client_id: "test_client_id" };

      // Call the remove method
      const result = await ClientSchema.remove({ filter });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.data).to.be.an("object").that.includes({
        client_id: "test_client_id",
        client_secret: "test_secret",
        name: "Test Client",
      });
      expect(result.message).to.equal("successfully removed the client");
      // Add more assertions to verify the result
    });

    it("should return an error when client does not exist", async () => {
      // Mock the input filter with non-existing client
      const filter = { client_id: "nonexistent_client" };

      // Call the remove method
      const result = await ClientSchema.remove({ filter });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.errors).to.deep.equal({
        message: "client does not exist, please crosscheck",
      });
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
      // Add more assertions to verify the result
    });

    // Add more test cases to cover additional scenarios if needed
  });
});

describe("ClientSchema - Methods", () => {
  describe("Method: toJSON", () => {
    it("should return the JSON representation of the client object", () => {
      // Mock a client object
      const client = new ClientSchema({
        _id: mongoose.Types.ObjectId(),
        client_id: "test_client_id",
        client_secret: "test_secret",
        name: "Test Client",
        redirect_uri: "https://example.com/callback",
      });

      // Call the toJSON method
      const result = client.toJSON();

      // Assertions
      expect(result).to.be.an("object").that.includes({
        _id: client._id,
        client_id: client.client_id,
        client_secret: client.client_secret,
        name: client.name,
        redirect_uri: client.redirect_uri,
      });
      // Add more assertions to verify the result
    });

    it("should only include the specified fields in the JSON representation", () => {
      // Mock a client object with additional fields
      const client = new ClientSchema({
        _id: mongoose.Types.ObjectId(),
        client_id: "test_client_id",
        client_secret: "test_secret",
        name: "Test Client",
        redirect_uri: "https://example.com/callback",
        networks: [mongoose.Types.ObjectId()],
        description: "Test description",
      });

      // Call the toJSON method
      const result = client.toJSON();

      // Assertions
      expect(result).to.be.an("object").that.includes({
        _id: client._id,
        client_id: client.client_id,
        client_secret: client.client_secret,
        name: client.name,
        redirect_uri: client.redirect_uri,
      });
      expect(result).to.not.have.property("networks");
      expect(result).to.not.have.property("description");
      // Add more assertions to verify the result
    });

    // Add more test cases to cover additional scenarios if needed
  });
});
