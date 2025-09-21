const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/update-grid-flags-job`
);
const GridModel = require("@models/Grid");
const cron = require("node-cron");
const { logObject, logText } = require("@utils/shared");

const JOB_NAME = "update-grid-flags-job";
const JOB_SCHEDULE = "0 */8 * * *"; // Every 8 hours

const countryCodes = {
  Uganda: "ug",
  Kenya: "ke",
  Nigeria: "ng",
  Cameroon: "cm",
  Ghana: "gh",
  Senegal: "sn",
  "Ivory Coast": "ci",
  Tanzania: "tz",
  Burundi: "bi",
  Rwanda: "rw",
  "Democratic Republic of the Congo": "cd",
  Zambia: "zm",
  Mozambique: "mz",
  Malawi: "mw",
  Zimbabwe: "zw",
  Botswana: "bw",
  Namibia: "na",
  "South Africa": "za",
  Lesotho: "ls",
  Eswatini: "sz",
  Angola: "ao",
  "Republic of the Congo": "cg",
  Gabon: "ga",
  "Equatorial Guinea": "gq",
  "Central African Republic": "cf",
  Chad: "td",
  Niger: "ne",
  Mali: "ml",
  "Burkina Faso": "bf",
  Togo: "tg",
  Benin: "bj",
  "Sierra Leone": "sl",
  Liberia: "lr",
  Guinea: "gn",
  "Guinea-Bissau": "gw",
  Gambia: "gm",
  "Cape Verde": "cv",
  Mauritania: "mr",
  "Western Sahara": "eh",
  Morocco: "ma",
  Algeria: "dz",
  Tunisia: "tn",
  Libya: "ly",
  Egypt: "eg",
  Sudan: "sd",
  "South Sudan": "ss",
  Eritrea: "er",
  Djibouti: "dj",
  Somalia: "so",
  Ethiopia: "et",
  Comoros: "km",
  Seychelles: "sc",
  Mauritius: "mu",
  Madagascar: "mg",
};

const getFlagUrl = (countryName) => {
  if (!countryName) {
    return null;
  }
  const lowerCountryName = countryName.toLowerCase().trim();
  const countryEntry = Object.entries(countryCodes).find(
    ([key, value]) => key.toLowerCase() === lowerCountryName
  );
  if (countryEntry) {
    const code = countryEntry[1];
    return `https://flagcdn.com/w320/${code.toLowerCase()}.png`;
  }
  return null;
};

const updateGridFlags = async () => {
  try {
    logText(`Starting ${JOB_NAME}...`);

    const gridsToUpdate = await GridModel("airqo")
      .find({
        admin_level: "country",
        $or: [
          { flag_url: { $exists: false } },
          { flag_url: null },
          { flag_url: "" },
        ],
      })
      .lean();

    if (gridsToUpdate.length === 0) {
      logText("No country grids need flag URL updates.");
      return;
    }

    logObject("Grids to update", gridsToUpdate.length);

    const bulkOps = gridsToUpdate
      .map((grid) => {
        const flagUrl = getFlagUrl(grid.name);
        if (flagUrl) {
          return {
            updateOne: {
              filter: { _id: grid._id },
              update: { $set: { flag_url: flagUrl } },
            },
          };
        }
        return null;
      })
      .filter(Boolean);

    if (bulkOps.length > 0) {
      const result = await GridModel("airqo").bulkWrite(bulkOps);
      logText(
        `Successfully updated flag_url for ${result.modifiedCount} grids.`
      );
    } else {
      logText("No flag URLs could be generated for the pending grids.");
    }
  } catch (error) {
    logger.error(`🐛🐛 Error in ${JOB_NAME}: ${error.message}`);
  }
};

const startJob = () => {
  let isJobRunning = false;
  const cronJobInstance = cron.schedule(JOB_SCHEDULE, async () => {
    if (isJobRunning) {
      logger.warn(`${JOB_NAME} is already running, skipping this execution.`);
      return;
    }
    isJobRunning = true;
    await updateGridFlags();
    isJobRunning = false;
  });

  if (!global.cronJobs) {
    global.cronJobs = {};
  }

  global.cronJobs[JOB_NAME] = {
    job: cronJobInstance,
    stop: async () => {
      cronJobInstance.stop();
      delete global.cronJobs[JOB_NAME];
    },
  };

  console.log(`✅ ${JOB_NAME} started`);
};

startJob();

module.exports = {
  updateGridFlags,
};
