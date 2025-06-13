// migration-add-taglines.js
const HealthTipModel = require("@models/HealthTips");

// Define default tag lines for each AQI range
const DEFAULT_TAG_LINES = {
  "0-9.1": "Today is a great day for outdoor activity.",
  "9.101-35.49": "The air quality today is moderate.",
  "35.491-55.49": "The air quality is unhealthy for sensitive people.",
  "55.491-125.49": "The air quality today might irritate your lungs.",
  "125.491-225.49": "The air quality is reaching levels of high alert.",
  "225.491-null": "The air quality can cause a health emergency.",
};

function getAqiRangeKey(min, max) {
  return max === null ? `${min}-null` : `${min}-${max}`;
}

function getDefaultTagLine(aqiCategory) {
  const key = getAqiRangeKey(aqiCategory.min, aqiCategory.max);
  return DEFAULT_TAG_LINES[key] || "Air quality information available.";
}

async function migrateTagLines(tenant = "airqo") {
  try {
    console.log("Starting tag line migration...");

    const HealthTip = HealthTipModel(tenant);

    // Find all tips without tag_line or with empty tag_line
    const tipsWithoutTagLines = await HealthTip.find({
      $or: [
        { tag_line: { $exists: false } },
        { tag_line: null },
        { tag_line: "" },
      ],
    });

    console.log(`Found ${tipsWithoutTagLines.length} tips without tag lines`);

    if (tipsWithoutTagLines.length === 0) {
      console.log("No tips need tag line updates");
      return { success: true, updatedCount: 0 };
    }

    const bulkOps = tipsWithoutTagLines.map((tip) => {
      const defaultTagLine = getDefaultTagLine(tip.aqi_category);

      return {
        updateOne: {
          filter: { _id: tip._id },
          update: { $set: { tag_line: defaultTagLine } },
        },
      };
    });

    const result = await HealthTip.bulkWrite(bulkOps);

    console.log(
      `Successfully updated ${result.modifiedCount} tips with tag lines`
    );

    return {
      success: true,
      updatedCount: result.modifiedCount,
      details: tipsWithoutTagLines.map((tip) => ({
        _id: tip._id,
        title: tip.title,
        aqi_category: tip.aqi_category,
        new_tag_line: getDefaultTagLine(tip.aqi_category),
      })),
    };
  } catch (error) {
    console.error("Migration failed:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = { migrateTagLines };
