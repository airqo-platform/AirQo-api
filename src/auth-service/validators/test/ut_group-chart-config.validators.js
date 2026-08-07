require("module-alias/register");
process.env.TENANTS = "kcca,airqo,airqount";
const chai = require("chai");
const { expect } = chai;
const express = require("express");
const request = require("supertest");
const { validationResult } = require("express-validator");

const {
  create,
  update,
  delete: deleteValidations,
  list,
  getById,
} = require("@validators/group-chart-config.validators");

const mongoose = require("mongoose");
const validId = () => new mongoose.Types.ObjectId().toHexString();

function buildApp(middleware) {
  const app = express();
  app.use(express.json());
  const handler = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }
    res.json({ success: true });
  };
  app.post("/test/groups/:grp_id/:deviceId/charts", ...middleware, handler);
  app.put(
    "/test/groups/:grp_id/:deviceId/charts/:chartId",
    ...middleware,
    handler
  );
  app.delete(
    "/test/groups/:grp_id/:deviceId/charts/:chartId",
    ...middleware,
    handler
  );
  app.get("/test/groups/:grp_id/:deviceId/charts", ...middleware, handler);
  app.get(
    "/test/groups/:grp_id/:deviceId/charts/:chartId",
    ...middleware,
    handler
  );
  return app;
}

describe("group-chart-config validators", () => {
  describe("create", () => {
    const app = buildApp(create);

    it("rejects an invalid grp_id", async () => {
      const res = await request(app)
        .post(`/test/groups/not-an-id/${validId()}/charts`)
        .send({ chartConfig: { fieldId: 1 } });
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include("Invalid Group ID");
    });

    it("rejects an invalid deviceId", async () => {
      const res = await request(app)
        .post(`/test/groups/${validId()}/not-an-id/charts`)
        .send({ chartConfig: { fieldId: 1 } });
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include("Invalid Device ID");
    });

    it("rejects a missing chartConfig", async () => {
      const res = await request(app)
        .post(`/test/groups/${validId()}/${validId()}/charts`)
        .send({});
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include(
        "chartConfig object is required"
      );
    });

    it("rejects a chartConfig missing fieldId", async () => {
      const res = await request(app)
        .post(`/test/groups/${validId()}/${validId()}/charts`)
        .send({ chartConfig: { title: "no field id" } });
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include(
        "fieldId is required in chartConfig"
      );
    });

    it("rejects a fieldId out of the 1-8 range", async () => {
      const res = await request(app)
        .post(`/test/groups/${validId()}/${validId()}/charts`)
        .send({ chartConfig: { fieldId: 9 } });
      expect(res.status).to.equal(422);
    });

    it("accepts a well-formed request", async () => {
      const res = await request(app)
        .post(`/test/groups/${validId()}/${validId()}/charts`)
        .send({ chartConfig: { fieldId: 1, title: "PM2.5" } });
      expect(res.status).to.equal(200);
      expect(res.body.success).to.equal(true);
    });
  });

  describe("update", () => {
    const app = buildApp(update);

    it("rejects an invalid chartId", async () => {
      const res = await request(app)
        .put(`/test/groups/${validId()}/${validId()}/charts/not-an-id`)
        .send({ title: "New" });
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include("Invalid Chart ID");
    });

    it("rejects an invalid chartType", async () => {
      const res = await request(app)
        .put(`/test/groups/${validId()}/${validId()}/charts/${validId()}`)
        .send({ chartType: "NotARealType" });
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include("Invalid chart type");
    });

    it("accepts a well-formed partial update", async () => {
      const res = await request(app)
        .put(`/test/groups/${validId()}/${validId()}/charts/${validId()}`)
        .send({ title: "New title", chartType: "Bar" });
      expect(res.status).to.equal(200);
    });
  });

  describe("delete", () => {
    const app = buildApp(deleteValidations);

    it("rejects an invalid chartId value ('not-an-id') with 422", async () => {
      const res = await request(app).delete(
        `/test/groups/${validId()}/${validId()}/charts/not-an-id`
      );
      expect(res.status).to.equal(422);
    });

    it("accepts valid ids", async () => {
      const res = await request(app).delete(
        `/test/groups/${validId()}/${validId()}/charts/${validId()}`
      );
      expect(res.status).to.equal(200);
    });
  });

  describe("list", () => {
    const app = buildApp(list);

    it("accepts valid grp_id/deviceId", async () => {
      const res = await request(app).get(
        `/test/groups/${validId()}/${validId()}/charts`
      );
      expect(res.status).to.equal(200);
    });

    it("rejects an invalid grp_id", async () => {
      const res = await request(app).get(
        `/test/groups/not-an-id/${validId()}/charts`
      );
      expect(res.status).to.equal(422);
    });

    it("rejects tenant=not-a-tenant — confirms commonValidations.tenant is actually wired in", async () => {
      const res = await request(app).get(
        `/test/groups/${validId()}/${validId()}/charts?tenant=not-a-tenant`
      );
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include(
        "the tenant value is not among the expected ones"
      );
    });
  });

  describe("getById", () => {
    const app = buildApp(getById);

    it("accepts valid ids", async () => {
      const res = await request(app).get(
        `/test/groups/${validId()}/${validId()}/charts/${validId()}`
      );
      expect(res.status).to.equal(200);
    });
  });
});
