require("module-alias/register");
process.env.TENANTS = "kcca,airqo,airqount";
const chai = require("chai");
const { expect } = chai;
const express = require("express");
const request = require("supertest");
const { validationResult } = require("express-validator");

const {
  createChart,
  updateChart,
  deleteChart,
  getChartConfigurations,
  getChartConfigurationById,
  copyChart,
} = require("@validators/preferences.validators");

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
  app.post("/test/charts", ...middleware, handler);
  app.put("/test/charts/:chartId", ...middleware, handler);
  app.delete("/test/charts/:chartId", ...middleware, handler);
  app.get("/test/charts", ...middleware, handler);
  app.get("/test/charts/:chartId", ...middleware, handler);
  app.post("/test/charts/:chartId/copy", ...middleware, handler);
  return app;
}

describe("personal chart validators", () => {
  describe("createChart", () => {
    const app = buildApp(createChart);

    it("rejects when neither device_ids nor site_ids is provided", async () => {
      const res = await request(app)
        .post("/test/charts")
        .send({ chartConfig: { fieldId: 1 } });
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include(
        "At least one of device_ids or site_ids is required"
      );
    });

    it("rejects when device_ids/site_ids are present but both empty", async () => {
      const res = await request(app)
        .post("/test/charts")
        .send({ chartConfig: { fieldId: 1 }, device_ids: [], site_ids: [] });
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include(
        "At least one of device_ids or site_ids is required"
      );
    });

    it("rejects a device_ids entry that isn't a valid ObjectId", async () => {
      const res = await request(app)
        .post("/test/charts")
        .send({ chartConfig: { fieldId: 1 }, device_ids: ["not-an-id"] });
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include(
        "device_ids must be an array of valid ObjectId strings"
      );
    });

    it("rejects a missing chartConfig", async () => {
      const res = await request(app)
        .post("/test/charts")
        .send({ device_ids: [validId()] });
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include(
        "chartConfig object is required"
      );
    });

    it("rejects a chartConfig missing fieldId", async () => {
      const res = await request(app)
        .post("/test/charts")
        .send({ chartConfig: {}, device_ids: [validId()] });
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include(
        "fieldId is required in chartConfig"
      );
    });

    it("rejects a chartConfig.locationColors entry with an invalid id", async () => {
      const res = await request(app)
        .post("/test/charts")
        .send({
          chartConfig: {
            fieldId: 1,
            locationColors: [{ id: "not-an-id", color: "#FF0000" }],
          },
          device_ids: [validId()],
        });
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include(
        "locationColors[].id must be a valid ObjectId"
      );
    });

    it("rejects a chartConfig.locationColors entry missing id", async () => {
      const res = await request(app)
        .post("/test/charts")
        .send({
          chartConfig: {
            fieldId: 1,
            locationColors: [{ color: "#FF0000" }],
          },
          device_ids: [validId()],
        });
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include(
        "locationColors[].id is required"
      );
    });

    it("rejects a chartConfig.locationColors entry missing color", async () => {
      const res = await request(app)
        .post("/test/charts")
        .send({
          chartConfig: {
            fieldId: 1,
            locationColors: [{ id: validId() }],
          },
          device_ids: [validId()],
        });
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include(
        "locationColors[].color is required"
      );
    });

    it("accepts a request with no locationColors at all", async () => {
      const res = await request(app)
        .post("/test/charts")
        .send({
          chartConfig: { fieldId: 1 },
          device_ids: [validId()],
        });
      expect(res.status).to.equal(200);
    });

    it("accepts a well-formed request scoped to device_ids only", async () => {
      const res = await request(app)
        .post("/test/charts")
        .send({
          chartConfig: {
            fieldId: 1,
            title: "PM2.5",
            subTitle: "Kampala vs Jinja",
          },
          device_ids: [validId()],
        });
      expect(res.status).to.equal(200);
    });

    it("accepts a well-formed request with locationColors matching selected ids", async () => {
      const deviceId = validId();
      const res = await request(app)
        .post("/test/charts")
        .send({
          chartConfig: {
            fieldId: 1,
            locationColors: [{ id: deviceId, color: "#FF0000" }],
          },
          device_ids: [deviceId],
        });
      expect(res.status).to.equal(200);
    });

    it("accepts a well-formed request with sites/devices display-name entries", async () => {
      const siteId = validId();
      const deviceId = validId();
      const res = await request(app)
        .post("/test/charts")
        .send({
          chartConfig: {
            fieldId: 1,
            sites: [{ site_id: siteId, name: "Site A" }],
            devices: [{ device_id: deviceId, name: "Device A" }],
          },
          site_ids: [siteId],
          device_ids: [deviceId],
        });
      expect(res.status).to.equal(200);
    });

    it("rejects a chartConfig.sites entry with an invalid site_id", async () => {
      const res = await request(app)
        .post("/test/charts")
        .send({
          chartConfig: {
            fieldId: 1,
            sites: [{ site_id: "not-an-id", name: "Site A" }],
          },
          site_ids: [validId()],
        });
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include(
        "sites[].site_id must be a valid ObjectId"
      );
    });

    it("rejects a chartConfig.sites entry missing site_id", async () => {
      const res = await request(app)
        .post("/test/charts")
        .send({
          chartConfig: { fieldId: 1, sites: [{ name: "Site A" }] },
          site_ids: [validId()],
        });
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include(
        "sites[].site_id is required"
      );
    });

    it("rejects a chartConfig.sites entry with an empty name", async () => {
      const siteId = validId();
      const res = await request(app)
        .post("/test/charts")
        .send({
          chartConfig: { fieldId: 1, sites: [{ site_id: siteId, name: "  " }] },
          site_ids: [siteId],
        });
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include(
        "sites[].name must be a non-empty string"
      );
    });

    it("rejects a chartConfig.sites entry with a name over 200 characters", async () => {
      const siteId = validId();
      const res = await request(app)
        .post("/test/charts")
        .send({
          chartConfig: {
            fieldId: 1,
            sites: [{ site_id: siteId, name: "x".repeat(201) }],
          },
          site_ids: [siteId],
        });
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include(
        "sites[].name must not exceed 200 characters"
      );
    });

    it("rejects a chartConfig.devices entry missing device_id", async () => {
      const res = await request(app)
        .post("/test/charts")
        .send({
          chartConfig: { fieldId: 1, devices: [{ name: "Device A" }] },
          device_ids: [validId()],
        });
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include(
        "devices[].device_id is required"
      );
    });
  });

  describe("updateChart", () => {
    const app = buildApp(updateChart);

    it("rejects an invalid chartId", async () => {
      const res = await request(app)
        .put("/test/charts/not-an-id")
        .send({ title: "New" });
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include("Invalid Chart ID");
    });

    it("rejects an invalid chartType", async () => {
      const res = await request(app)
        .put(`/test/charts/${validId()}`)
        .send({ chartType: "NotARealType" });
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include("Invalid chart type");
    });

    it("rejects when device_ids and site_ids are both explicitly sent empty", async () => {
      const res = await request(app)
        .put(`/test/charts/${validId()}`)
        .send({ device_ids: [], site_ids: [] });
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include(
        "device_ids and site_ids cannot both be cleared"
      );
    });

    it("accepts clearing just one scope array when the other is left untouched — the validator can't know the existing doc's scope, so this is allowed here and guarded again at the util layer", async () => {
      const res = await request(app)
        .put(`/test/charts/${validId()}`)
        .send({ device_ids: [] });
      expect(res.status).to.equal(200);
    });

    it("accepts a well-formed partial update including subTitle and locationColors", async () => {
      const deviceId = validId();
      const res = await request(app)
        .put(`/test/charts/${validId()}`)
        .send({
          title: "New title",
          subTitle: "New subtitle",
          device_ids: [deviceId],
          locationColors: [{ id: deviceId, color: "#00AA00" }],
        });
      expect(res.status).to.equal(200);
    });

    it("rejects a locationColors entry missing id", async () => {
      const res = await request(app)
        .put(`/test/charts/${validId()}`)
        .send({ locationColors: [{ color: "#00AA00" }] });
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include(
        "locationColors[].id is required"
      );
    });

    it("rejects a locationColors entry missing color", async () => {
      const res = await request(app)
        .put(`/test/charts/${validId()}`)
        .send({ locationColors: [{ id: validId() }] });
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include(
        "locationColors[].color is required"
      );
    });

    it("accepts a well-formed update with sites/devices display-name entries", async () => {
      const siteId = validId();
      const res = await request(app)
        .put(`/test/charts/${validId()}`)
        .send({
          site_ids: [siteId],
          sites: [{ site_id: siteId, name: "Site A" }],
        });
      expect(res.status).to.equal(200);
    });

    it("rejects a sites entry with an invalid site_id", async () => {
      const res = await request(app)
        .put(`/test/charts/${validId()}`)
        .send({ sites: [{ site_id: "not-an-id", name: "Site A" }] });
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include(
        "sites[].site_id must be a valid ObjectId"
      );
    });

    it("rejects a devices entry with an empty name", async () => {
      const deviceId = validId();
      const res = await request(app)
        .put(`/test/charts/${validId()}`)
        .send({ devices: [{ device_id: deviceId, name: "" }] });
      expect(res.status).to.equal(422);
      expect(JSON.stringify(res.body)).to.include(
        "devices[].name must be a non-empty string"
      );
    });
  });

  describe("deleteChart", () => {
    const app = buildApp(deleteChart);

    it("rejects an invalid chartId", async () => {
      const res = await request(app).delete("/test/charts/not-an-id");
      expect(res.status).to.equal(422);
    });

    it("accepts a valid chartId", async () => {
      const res = await request(app).delete(`/test/charts/${validId()}`);
      expect(res.status).to.equal(200);
    });
  });

  describe("getChartConfigurations", () => {
    const app = buildApp(getChartConfigurations);

    it("accepts no filters", async () => {
      const res = await request(app).get("/test/charts");
      expect(res.status).to.equal(200);
    });

    it("accepts optional group_id/device_id/site_id query filters", async () => {
      const res = await request(app).get(
        `/test/charts?group_id=${validId()}&device_id=${validId()}&site_id=${validId()}`
      );
      expect(res.status).to.equal(200);
    });

    it("rejects an invalid device_id query filter", async () => {
      const res = await request(app).get("/test/charts?device_id=not-an-id");
      expect(res.status).to.equal(422);
    });
  });

  describe("getChartConfigurationById", () => {
    const app = buildApp(getChartConfigurationById);

    it("rejects an invalid chartId", async () => {
      const res = await request(app).get("/test/charts/not-an-id");
      expect(res.status).to.equal(422);
    });

    it("accepts a valid chartId", async () => {
      const res = await request(app).get(`/test/charts/${validId()}`);
      expect(res.status).to.equal(200);
    });
  });

  describe("copyChart", () => {
    const app = buildApp(copyChart);

    it("rejects an invalid chartId", async () => {
      const res = await request(app).post("/test/charts/not-an-id/copy");
      expect(res.status).to.equal(422);
    });

    it("accepts a valid chartId", async () => {
      const res = await request(app).post(`/test/charts/${validId()}/copy`);
      expect(res.status).to.equal(200);
    });
  });
});
