require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const express = require("express");
const supertest = require("supertest");
const app = express();
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const request = supertest(app);

describe("Group Router", () => {
  describe("DELETE /groups/:grp_id", () => {
    it("should delete a group successfully", async () => {
      // Create a new group to be deleted
      const newGroup = { name: "Test Group" };
      const group = await GroupModel.create(newGroup);

      // Make the DELETE request to delete the group
      const response = await supertest(app)
        .delete(`/groups/${group._id}`)
        .expect(200);

      // Expectations
      expect(response.body.success).to.be.true;
      expect(response.body.message).to.equal("Group deleted successfully");
      expect(response.body.data._id).to.equal(group._id.toString());

      // Check if the group is actually deleted from the database
      const deletedGroup = await GroupModel.findById(group._id);
      expect(deletedGroup).to.be.null;
    });

    it("should return an error if the group ID is not valid", async () => {
      const invalidGroupId = "invalid-id"; // Provide an invalid group ID

      // Make the DELETE request with an invalid group ID
      const response = await supertest(app)
        .delete(`/groups/${invalidGroupId}`)
        .expect(400);

      // Expectations
      expect(response.body.success).to.be.false;
      expect(response.body.message).to.equal("Bad Request Error");
      expect(response.body.errors.message).to.equal(
        "The group ID parameter must be an object ID"
      );
    });

    // Add more test cases for different scenarios
  });
  describe("PUT /groups/:grp_id", () => {
    it("should update a group successfully", async () => {
      const grpId = new ObjectId(); // Replace with a valid group ID

      const updateData = {
        grp_description: "Updated Description",
        grp_status: true,
      };

      const response = await request
        .put(`/groups/${grpId}`)
        .query({ tenant: "kcca" })
        .send(updateData)
        .set("Authorization", "");

      // Assertions
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property("success").to.be.true;
      expect(response.body).to.have.property("message").to.be.a("string");
      expect(response.body).to.have.property("data").to.be.an("object");

      // Add more specific assertions based on your controller logic
    });

    it("should handle validation errors", async () => {
      const grpId = "invalid-id"; // An invalid group ID

      const updateData = {
        grp_description: "",
        grp_status: "invalid-boolean",
      };

      const response = await request
        .put(`/groups/${grpId}`)
        .query({ tenant: "invalid-tenant" })
        .send(updateData)
        .set("Authorization", "");

      // Assertions for validation errors
      expect(response.status).to.equal(400); // You can adjust the expected status code
      expect(response.body).to.have.property("success").to.be.false;
      expect(response.body).to.have.property("message").to.be.a("string");
      expect(response.body).to.have.property("errors").to.be.an("object");

      // Add more specific assertions based on your validation logic
    });

    // Add more test cases as needed
  });
  describe("GET /groups", () => {
    it("should list groups with valid query parameters", async () => {
      const queryParams = {
        tenant: "kcca", // Replace with a valid tenant value
        grp_id: new ObjectId(), // Replace with a valid group ID
        grp_title: "Group Title", // Replace with a valid group title
        grp_status: "Active", // Replace with a valid group status
      };

      const response = await request.get("/groups").query(queryParams);

      // Assertions
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property("success").to.be.true;
      expect(response.body).to.have.property("message").to.be.a("string");
      expect(response.body).to.have.property("data").to.be.an("array");

      // Add more specific assertions based on your controller logic
    });

    it("should handle validation errors", async () => {
      // Invalid query parameters
      const queryParams = {
        tenant: "invalid-tenant", // Invalid tenant
        grp_id: "invalid-id", // Invalid group ID
        grp_title: "", // Invalid group title (empty)
        grp_status: "", // Invalid group status (empty)
      };

      const response = await request.get("/groups").query(queryParams);

      // Assertions for validation errors
      expect(response.status).to.equal(400); // You can adjust the expected status code
      expect(response.body).to.have.property("success").to.be.false;
      expect(response.body).to.have.property("message").to.be.a("string");
      expect(response.body).to.have.property("errors").to.be.an("object");

      // Add more specific assertions based on your validation logic
    });

    // Add more test cases as needed
  });
  describe("POST /groups", () => {
    it("should create a new group with valid request data", async () => {
      const requestData = {
        tenant: "kcca", // Replace with a valid tenant value
        grp_title: "New Group", // Replace with a valid group title
        grp_description: "Group Description", // Replace with a valid group description
      };

      const response = await request.post("/groups").send(requestData);

      // Assertions
      expect(response.status).to.equal(201);
      expect(response.body).to.have.property("success").to.be.true;
      expect(response.body).to.have.property("message").to.be.a("string");
      expect(response.body).to.have.property("data").to.be.an("object");

      // Add more specific assertions based on your controller logic
    });

    it("should handle validation errors", async () => {
      // Invalid request data
      const requestData = {
        tenant: "invalid-tenant", // Invalid tenant
        grp_title: "", // Invalid group title (empty)
        grp_description: "", // Invalid group description (empty)
      };

      const response = await request.post("/groups").send(requestData);

      // Assertions for validation errors
      expect(response.status).to.equal(400); // You can adjust the expected status code
      expect(response.body).to.have.property("success").to.be.false;
      expect(response.body).to.have.property("message").to.be.a("string");
      expect(response.body).to.have.property("errors").to.be.an("object");

      // Add more specific assertions based on your validation logic
    });

    // Add more test cases as needed
  });
  describe("PUT /groups/:grp_id/assign-user/:user_id", () => {
    it("should assign a user to a group with valid request data", async () => {
      // Replace with valid grp_id and user_id
      const grpId = "valid-group-id";
      const userId = "valid-user-id";

      const requestData = {
        tenant: "kcca", // Replace with a valid tenant value
      };

      const response = await request
        .put(`/groups/${grpId}/assign-user/${userId}`)
        .query(requestData);

      // Assertions
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property("success").to.be.true;
      expect(response.body).to.have.property("message").to.be.a("string");
      expect(response.body).to.have.property("data").to.be.an("object");

      // Add more specific assertions based on your controller logic
    });

    it("should handle validation errors", async () => {
      // Invalid request data
      const grpId = "invalid-group-id"; // Invalid grp_id
      const userId = "invalid-user-id"; // Invalid user_id

      const requestData = {
        tenant: "invalid-tenant", // Invalid tenant
      };

      const response = await request
        .put(`/groups/${grpId}/assign-user/${userId}`)
        .query(requestData);

      // Assertions for validation errors
      expect(response.status).to.equal(400); // You can adjust the expected status code
      expect(response.body).to.have.property("success").to.be.false;
      expect(response.body).to.have.property("message").to.be.a("string");
      expect(response.body).to.have.property("errors").to.be.an("object");

      // Add more specific assertions based on your validation logic
    });

    // Add more test cases as needed
  });
  describe("GET /groups/summary", () => {
    it("should get a summary of groups with valid request data", async () => {
      const requestData = {
        tenant: "kcca", // Replace with a valid tenant value
      };

      const response = await request.get("/groups/summary").query(requestData);

      // Assertions
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property("success").to.be.true;
      expect(response.body).to.have.property("message").to.be.a("string");
      expect(response.body).to.have.property("data").to.be.an("array");

      // Add more specific assertions based on your controller logic
    });

    it("should handle validation errors", async () => {
      // Invalid request data
      const requestData = {
        tenant: "invalid-tenant", // Invalid tenant
      };

      const response = await request.get("/groups/summary").query(requestData);

      // Assertions for validation errors
      expect(response.status).to.equal(400); // You can adjust the expected status code
      expect(response.body).to.have.property("success").to.be.false;
      expect(response.body).to.have.property("message").to.be.a("string");
      expect(response.body).to.have.property("errors").to.be.an("object");

      // Add more specific assertions based on your validation logic
    });

    // Add more test cases as needed
  });
  describe("GET /groups/:grp_id/assigned-users", () => {
    it("should get a list of assigned users for a valid group ID and tenant", async () => {
      const validGrpId = new ObjectId(); // Replace with a valid group ID
      const requestData = {
        tenant: "kcca", // Replace with a valid tenant value
      };

      const response = await request
        .get(`/groups/${validGrpId}/assigned-users`)
        .query(requestData);

      // Assertions
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property("success").to.be.true;
      expect(response.body).to.have.property("message").to.be.a("string");
      expect(response.body).to.have.property("data").to.be.an("array");

      // Add more specific assertions based on your controller logic
    });

    it("should handle validation errors", async () => {
      // Invalid group ID
      const invalidGrpId = "invalid-group-id";
      const requestData = {
        tenant: "kcca",
      };

      const response = await request
        .get(`/groups/${invalidGrpId}/assigned-users`)
        .query(requestData);

      // Assertions for validation errors
      expect(response.status).to.equal(400); // You can adjust the expected status code
      expect(response.body).to.have.property("success").to.be.false;
      expect(response.body).to.have.property("message").to.be.a("string");
      expect(response.body).to.have.property("errors").to.be.an("object");

      // Add more specific assertions based on your validation logic
    });

    // Add more test cases as needed
  });
  describe("GET /groups/:grp_id/available-users", () => {
    it("should get a list of available users for a valid group ID and tenant", async () => {
      const validGrpId = new ObjectId(); // Replace with a valid group ID
      const requestData = {
        tenant: "kcca", // Replace with a valid tenant value
      };

      const response = await request
        .get(`/groups/${validGrpId}/available-users`)
        .query(requestData);

      // Assertions
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property("success").to.be.true;
      expect(response.body).to.have.property("message").to.be.a("string");
      expect(response.body).to.have.property("data").to.be.an("array");

      // Add more specific assertions based on your controller logic
    });

    it("should handle validation errors", async () => {
      // Invalid group ID
      const invalidGrpId = "invalid-group-id";
      const requestData = {
        tenant: "kcca",
      };

      const response = await request
        .get(`/groups/${invalidGrpId}/available-users`)
        .query(requestData);

      // Assertions for validation errors
      expect(response.status).to.equal(400); // You can adjust the expected status code
      expect(response.body).to.have.property("success").to.be.false;
      expect(response.body).to.have.property("message").to.be.a("string");
      expect(response.body).to.have.property("errors").to.be.an("object");

      // Add more specific assertions based on your validation logic
    });

    // Add more test cases as needed
  });
  describe("POST /groups/:grp_id/assign-users", () => {
    it("should assign users to a group for a valid group ID, tenant, and user IDs", async () => {
      const validGrpId = new ObjectId(); // Replace with a valid group ID
      const requestData = {
        tenant: "kcca", // Replace with a valid tenant value
        user_ids: [new ObjectId(), new ObjectId()], // Replace with valid user IDs
      };

      const response = await request
        .post(`/groups/${validGrpId}/assign-users`)
        .query(requestData);

      // Assertions
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property("success").to.be.true;
      expect(response.body).to.have.property("message").to.be.a("string");

      // Add more specific assertions based on your controller logic
    });

    it("should handle validation errors", async () => {
      // Invalid group ID
      const invalidGrpId = "invalid-group-id";
      const requestData = {
        tenant: "kcca",
        user_ids: ["invalid-user-id"], // Invalid user ID format
      };

      const response = await request
        .post(`/groups/${invalidGrpId}/assign-users`)
        .query(requestData);

      // Assertions for validation errors
      expect(response.status).to.equal(400); // You can adjust the expected status code
      expect(response.body).to.have.property("success").to.be.false;
      expect(response.body).to.have.property("message").to.be.a("string");
      expect(response.body).to.have.property("errors").to.be.an("object");

      // Add more specific assertions based on your validation logic
    });

    // Add more test cases as needed
  });
  describe("DELETE /groups/:grp_id/unassign-user/:user_id", () => {
    it("should unassign a user from a group for a valid group ID, tenant, and user ID", async () => {
      const validGrpId = new ObjectId(); // Replace with a valid group ID
      const validUserId = new ObjectId(); // Replace with a valid user ID

      const response = await request
        .delete(`/groups/${validGrpId}/unassign-user/${validUserId}`)
        .query({ tenant: "kcca" }); // Replace with a valid tenant value

      // Assertions
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property("success").to.be.true;
      expect(response.body).to.have.property("message").to.be.a("string");

      // Add more specific assertions based on your controller logic
    });

    it("should handle validation errors", async () => {
      // Invalid group ID
      const invalidGrpId = "invalid-group-id";
      const validUserId = new ObjectId(); // Replace with a valid user ID

      const response = await request
        .delete(`/groups/${invalidGrpId}/unassign-user/${validUserId}`)
        .query({ tenant: "kcca" });

      // Assertions for validation errors
      expect(response.status).to.equal(400); // You can adjust the expected status code
      expect(response.body).to.have.property("success").to.be.false;
      expect(response.body).to.have.property("message").to.be.a("string");
      expect(response.body).to.have.property("errors").to.be.an("object");

      // Add more specific assertions based on your validation logic
    });

    // Add more test cases as needed
  });
  describe("DELETE /groups/:grp_id/unassign-many-users", () => {
    it("should unassign multiple users from a group for a valid group ID, tenant, and user IDs", async () => {
      const validGrpId = new ObjectId(); // Replace with a valid group ID
      const validUserIds = [new ObjectId(), new ObjectId()]; // Replace with valid user IDs
      const tenant = "kcca"; // Replace with a valid tenant value

      const response = await request
        .delete(`/groups/${validGrpId}/unassign-many-users`)
        .query({ tenant })
        .send({ user_ids: validUserIds });

      // Assertions
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property("success").to.be.true;
      expect(response.body).to.have.property("message").to.be.a("string");

      // Add more specific assertions based on your controller logic
    });

    it("should handle validation errors", async () => {
      // Invalid group ID
      const invalidGrpId = "invalid-group-id";
      const validUserIds = [new ObjectId(), new ObjectId()]; // Replace with valid user IDs
      const tenant = "kcca"; // Replace with a valid tenant value

      const response = await request
        .delete(`/groups/${invalidGrpId}/unassign-many-users`)
        .query({ tenant })
        .send({ user_ids: validUserIds });

      // Assertions for validation errors
      expect(response.status).to.equal(400); // You can adjust the expected status code
      expect(response.body).to.have.property("success").to.be.false;
      expect(response.body).to.have.property("message").to.be.a("string");
      expect(response.body).to.have.property("errors").to.be.an("object");

      // Add more specific assertions based on your validation logic
    });

    // Add more test cases as needed
  });
  describe("GET /groups/:grp_id", () => {
    it("should retrieve group information for a valid group ID and tenant", async () => {
      const validGrpId = new ObjectId(); // Replace with a valid group ID
      const tenant = "kcca"; // Replace with a valid tenant value

      const response = await request
        .get(`/groups/${validGrpId}`)
        .query({ tenant });

      // Assertions
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property("success").to.be.true;
      expect(response.body).to.have.property("message").to.be.a("string");
      expect(response.body).to.have.property("data").to.be.an("object");

      // Add more specific assertions based on your controller logic
    });

    it("should handle validation errors", async () => {
      // Invalid group ID
      const invalidGrpId = "invalid-group-id";
      const tenant = "kcca"; // Replace with a valid tenant value

      const response = await request
        .get(`/groups/${invalidGrpId}`)
        .query({ tenant });

      // Assertions for validation errors
      expect(response.status).to.equal(400); // You can adjust the expected status code
      expect(response.body).to.have.property("success").to.be.false;
      expect(response.body).to.have.property("message").to.be.a("string");
      expect(response.body).to.have.property("errors").to.be.an("object");

      // Add more specific assertions based on your validation logic
    });

    // Add more test cases as needed
  });
});
