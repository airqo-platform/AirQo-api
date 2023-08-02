require("module-alias/register");
const express = require("express");
const request = require("supertest");
const { expect } = require("chai");
const sinon = require("sinon");
const knowYourAirController = require("@controllers/create-know-your-air");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const router = require("@routes/v1/kya");

// Test data (if needed)
const testTenant = "test_tenant";
const testId = "test_id";
const testObjectId = new mongoose.Types.ObjectId();

describe("Know Your Air Router", () => {
  // Mock the headers middleware
  const mockHeaders = (req, res, next) => {
    next();
  };

  beforeEach(() => {
    sinon.restore();
  });

  describe("Middleware", () => {
    it("should call the headers middleware", async () => {
      sinon.stub(router, "use").callsFake(mockHeaders);
      const app = express();
      app.use("/", router);
      await request(app).get("/");
      expect(router.use.calledWith(mockHeaders)).to.be.true;
    });
  });

  describe("GET /lessons", () => {
    it("should call knowYourAirController.listLessons function", async () => {
      const listLessonsStub = sinon.stub(knowYourAirController, "listLessons");
      const app = express();
      app.use("/", router);
      await request(app).get("/lessons");
      expect(listLessonsStub.calledOnce).to.be.true;
      listLessonsStub.restore();
    });

    // Add more tests for query parameters and error cases if needed
  });

  // Add more describe blocks and tests for other endpoints such as "/lessons/users/:user_id", "/lessons", "/lessons/:lesson_id", "/progress/:user_id?", "/progress/lessons/:lesson_id/users/:user_id", "/progress/:progress_id", and "/"
});
