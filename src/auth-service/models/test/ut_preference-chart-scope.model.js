require("module-alias/register");
const chai = require("chai");
const { expect } = chai;
const mongoose = require("mongoose");
require("@config/database"); // fire-and-forget connect at module load — wait for it below
const PreferenceModel = require("@models/Preference");

describe("Preference model — chartConfigSchema locationColors scope", function() {
  this.timeout(20000);

  before(function(done) {
    if (mongoose.connection.readyState === 1) return done();
    mongoose.connection.once("connected", done);
    mongoose.connection.once("error", done);
  });

  const deviceId = new mongoose.Types.ObjectId();
  const siteId = new mongoose.Types.ObjectId();
  const unrelatedId = new mongoose.Types.ObjectId();

  function buildDoc(chartConfig) {
    const Model = PreferenceModel("airqo");
    return new Model({
      user_id: new mongoose.Types.ObjectId(),
      group_id: new mongoose.Types.ObjectId(),
      period: { value: "Last 7 days", label: "Last 7 days", unitValue: 7, unit: "day" },
      chartConfigurations: [chartConfig],
    });
  }

  // save()/findOneAndUpdate({ runValidators: true }) — what the real create/
  // update code paths use — run the async validate() pipeline, which is the
  // only one that executes a subdocument's pre("validate") hook in this
  // Mongoose version. validateSync() skips subdocument middleware entirely,
  // so it can't be used to exercise this hook.
  it("passes validation when a chart has no locationColors at all", async function() {
    const doc = buildDoc({ fieldId: 1, device_ids: [deviceId] });
    await doc.validate();
  });

  it("passes validation when every locationColors id is in device_ids or site_ids", async function() {
    const doc = buildDoc({
      fieldId: 1,
      device_ids: [deviceId],
      site_ids: [siteId],
      locationColors: [
        { id: deviceId, color: "#FF0000" },
        { id: siteId, color: "#FFFF00" },
      ],
    });
    await doc.validate();
  });

  it("fails validation when a locationColors id isn't in device_ids or site_ids", async function() {
    const doc = buildDoc({
      fieldId: 1,
      device_ids: [deviceId],
      locationColors: [{ id: unrelatedId, color: "#FF0000" }],
    });

    let err;
    try {
      await doc.validate();
    } catch (e) {
      err = e;
    }

    expect(err).to.not.equal(undefined);
    expect(err.message).to.include("locationColors");
  });
});
