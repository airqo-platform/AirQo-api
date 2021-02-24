const { BigQuery } = require("@google-cloud/bigquery");
const bigquery = new BigQuery();
const axios = require("axios");
const isEmpty = require("is-empty");

const DEVICE_REGISTRY_BASE_URI = "http://localhost:3000/api/v1/devices/";

const getDevices = async () => {
  console.log(".....getting device details......");
  try {
    let response = await axios.get(DEVICE_REGISTRY_BASE_URI, {
      params: {
        tenant: "airqo",
      },
    });
    if (response.data.devices) {
      return response.data.devices;
    } else {
      return [];
    }
  } catch (e) {
    console.log("GET DEVICE NAME ERROR: ", e.message);
  }
};

const transformMeasurement = async (measurement) => {
  console.log(".....transforming measurements......");
  try {
    let newObj = await Object.entries(measurement).reduce(
      (newObj, [field, value]) => {
        return { ...newObj, [field]: { value } };
      },
      {}
    );
    return newObj;
  } catch (e) {
    console.log(e.message);
  }
};

async function query(channelID) {
  /***
   * we need to review the mappings for humidity and temperature
   */
  console.log(".......querying BQ.......");
  try {
    const query = `SELECT created_at as time, pm2_5, pm10 , s2_pm2_5,
  s2_pm10, temperature as internalTemperature, humidity as internalHumidity, voltage as battery, altitude, no_sats as satellites, hdope as hdop, wind as speed FROM \`airqo-250220.thingspeak.clean_feeds_pms\` WHERE channel_id=${channelID} ORDER BY created_at ASC`;

    // For all options, see https://cloud.google.com/bigquery/docs/reference/rest/v2/jobs/query
    const options = {
      query: query,
      location: "US",
    };
    const [job] = await bigquery.createQueryJob(options);
    console.log(`Job ${job.id} started.`);
    const [rows] = await job.getQueryResults();
    // console.log("Rows:");
    // console.log(rows);
    return rows;
  } catch (e) {
    console.log("error", e.message);
  }
}

const generateRequestBody = async (channel) => {
  console.log(".......generating request body.......");
  const tranformedData = [];
  // console.log("the channel: ", channel);
  const data = await query(channel);
  // console.log("data from BQ: ", data);
  if (!isEmpty(data)) {
    for (const entry of data) {
      let time = entry.time;
      let transformed = await transformMeasurement(entry);
      tranformedData.push({
        ...transformed,
        time: time.value,
        frequency: "minute",
        channelID: channel,
      });
    }
    return tranformedData;
  } else {
    return [];
  }
};

const chunk = (arr) => {
  const size = 20;
  const chunkedArray = [];
  for (let i = 0; i < arr.length; i++) {
    const last = chunkedArray[chunkedArray.length - 1];
    if (!last || last.length === size) {
      chunkedArray.push([arr[i]]);
    } else {
      last.push(arr[i]);
    }
  }
  return chunkedArray;
};

async function main() {
  console.log(".....starting the operation......");
  const devices = await getDevices();
  try {
    for (const item of devices) {
      const insert_api = `${DEVICE_REGISTRY_BASE_URI}/events/add?device=${item.name}&tenant=airqo`;
      // console.log("channel ID: ", item.channelID);
      const requestBody = await generateRequestBody(item.channelID);

      let chunkedRequestBody = chunk(requestBody);

      for (const chunked of chunkedRequestBody) {
        // console.log("the request body: ", requestBody);
        // if (!isEmpty(chunked)) {
        const options = {
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        };

        await axios
          .post(insert_api, chunked, options)
          .then((result) => {
            if (result.data.success) {
              console.log(
                `finished inserting data for device ${item.name} whose channel ID is ${item.channelID}`
              );
            } else {
              console.log(
                `unable to insert data for device ${item.name} whose channel ID is ${item.channelID}`
              );
            }
          })
          .catch((e) => {
            console.log(
              `unable to insert data for device ${item.name} whose channel ID is ${item.channelID} because of: ${e.message}`
            );
          });
        // } else {
        //   continue;
        // }
      }
    }
  } catch (e) {
    console.log("error: ", e);
  }
}

main(...process.argv.slice(2));
