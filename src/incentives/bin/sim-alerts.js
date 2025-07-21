const Queue = require("bull");
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- bin/sims-alerts`
);
const createSimUtil = require("@utils/create-sim");
const SimModel = require("@models/Sim");
const { logObject } = require("@utils/log");

const dataBalanceThreshold = 10;

const fetchSimsFromDatabase = async (tenant) => {
  const responseFromListSims = await SimModel(tenant).find({}).lean();
  logObject("responseFromListSims", responseFromListSims);
  return responseFromListSims;
};

const simStatusQueue = new Queue("simStatusQueue", {
  redis: {
    port: constants.REDIS_PORT,
    host: constants.REDIS_SERVER,
  },
});

const checkStatus = async (sim_id) => {
  let request = {};
  request.params = {};
  request.query = {};
  request.query.tenant = "airqo";
  request.params.sim_id = sim_id;
  const responseFromCreateSim = await createSimUtil.checkStatus(request);
  if (responseFromCreateSim.success === true) {
    const simStatus = responseFromCreateSim.data;
    logObject("simStatus", simStatus);
    if (simStatus.balance < dataBalanceThreshold) {
      logger.error(
        `SIM with ID ${sim_id} has low data balance: ${simStatus.balance} MB`
      );
    }
  }
};

const processSimStatusJob = async (job, done) => {
  const simList = await fetchSimsFromDatabase("airqo");
  logObject("simList", simList);
  for (const sim of simList) {
    await checkStatus(sim._id);
  }
};

simStatusQueue.add(
  {},
  {
    repeat: { every: 30 * 60 * 1000 },
  }
);

simStatusQueue.process(processSimStatusJob);

simStatusQueue.on("failed", (job, error) => {
  logObject("error", error);
  logger.error(`Job ${job.id} failed: ${error}`);
});
