/***
 * the data is in this format
 */
const deviceMeasurements = [
  "created_at",
  "pm2_5",
  "pm10",
  "s2_pm2_5",
  "s2_pm10",
  "temperature",
  "humidity",
  "voltage",
];

/***
 * what device are we testing with?
 */

/***
 * what are the components for the incoming device data
 */
const componentsAirQo = {
  pms5003_1: ["pm2.5", "pm10"],
  pms5003_2: ["s2_pm2.5", "s2_pm10"],
  DHT11: ["temperature", "humidity"],
  battery: ["voltage"],
};

const componentsKCCA = {
  relHumid: "",
  temperature: "",
  no2Conc: "",
  pm2_5ConcNum: "",
};

/**the events collection */
Events = {
  _id: { $oid: "5f5def45355eb916ced22730" },
  componentName: "aq_01_comp_23",
  day: { $date: "2020-09-13T06:41:28.774Z" },
  deviceName: "aq_01",
  __v: 0,
  createdAt: { $date: "2020-09-13T10:07:04.187Z" },
  first: { $date: "2020-09-13T06:41:28.774Z" },
  last: { $date: "2020-09-13T06:41:28.774Z" },
  nValues: 7,
  updatedAt: { $date: "2020-09-13T10:16:40.644Z" },
  values: [
    {
      _id: { $oid: "5f5def4866898c60ec8e3332" },
      value: 23,
      raw: 23,
      weight: 1,
      frequency: "day",
      time: { $date: "2020-09-13T06:41:28.774Z" },
      calibratedValue: 24,
      measurement: { quantityKind: "temperature", measurementUnit: "celsius" },
    },
    {
      _id: { $oid: "5f5df013a71c7445381d7a93" },
      value: 23,
      raw: 23,
      weight: 1,
      frequency: "day",
      time: { $date: "2020-09-13T06:41:28.774Z" },
      calibratedValue: 24,
      measurement: { quantityKind: "temperature", measurementUnit: "celsius" },
    },
    {
      _id: { $oid: "5f5df021a71c7445381d7a94" },
      value: 23,
      raw: 23,
      weight: 1,
      frequency: "day",
      time: { $date: "2020-09-13T06:41:28.774Z" },
      calibratedValue: 24,
      measurement: { quantityKind: "temperature", measurementUnit: "celsius" },
    },
    {
      _id: { $oid: "5f5df04fa71c7445381d7a95" },
      value: 23,
      raw: 23,
      weight: 1,
      frequency: "day",
      time: { $date: "2020-09-13T06:41:28.774Z" },
      calibratedValue: 24,
      measurement: { quantityKind: "temperature", measurementUnit: "celsius" },
    },
    {
      _id: { $oid: "5f5df088a71c7445381d7a96" },
      value: 23,
      raw: 23,
      weight: 1,
      frequency: "day",
      time: { $date: "2020-09-13T06:41:28.774Z" },
      calibratedValue: 24,
      measurement: { quantityKind: "temperature", measurementUnit: "celsius" },
    },
    {
      _id: { $oid: "5f5df112a71c7445381d7a97" },
      value: 23,
      raw: 23,
      weight: 1,
      frequency: "day",
      time: { $date: "2020-09-13T06:41:28.774Z" },
      calibratedValue: 24,
      measurement: { quantityKind: "temperature", measurementUnit: "celsius" },
    },
    {
      _id: { $oid: "5f5df188a71c7445381d7a98" },
      value: 56,
      raw: 23,
      weight: 34,
      frequency: "day",
      time: { $date: "2020-09-13T06:41:28.774Z" },
      calibratedValue: 24,
      measurement: { quantityKind: "temperature", measurementUnit: "celsius" },
    },
  ],
};

/***
 * each of these is a component
 */

try {
  let csv = "";

  /***
   * Assumption:
   * You cant insert of device (component) that does not exist
   * The part of inserting, we expect you to provide those details
   * the data that is coming through already has the channel ID which you can use to get the device name
   * Once you have the device name, basing on the naming convention of the platform (deviceName_comp_number)
   * ---we could make the naming convention be deviceName_componentName. Examples: aq_01_pms5003_1, aq_01_pms5003_2
   *   * /

   /**JOB:
   * You are wondering if you could bulk insertion - network. Each hour will have about 60 records, multiplied by 5 values
   * 60*80*5
   */

  let bulkBody = [
    {
      value: value,
      raw: value,
      weight: 1,
      frequency: "day",
      calibratedValue: calibratedValue,
      time: time,
      uncertaintyValue: 23,
      standardDeviationValue: 23,
      measurement: {
        quantityKind: "humidity",
        measurementUnit: "degrees",
      },
    },
    {
      value: value,
      raw: value,
      weight: 1,
      frequency: "day",
      calibratedValue: calibratedValue,
      time: time,
      uncertaintyValue: 23,
      standardDeviationValue: 23,
      measurement: {
        quantityKind: "humidity",
        measurementUnit: "degrees",
      },
    },
    {
      value: value,
      raw: value,
      weight: 1,
      frequency: "day",
      calibratedValue: calibratedValue,
      time: time,
      uncertaintyValue: 23,
      standardDeviationValue: 23,
      measurement: {
        quantityKind: "humidity",
        measurementUnit: "degrees",
      },
    },
  ];

  /***
   * THINK ABOUT: retrieving data out of the events collection
   */

  /***
   * for one particular row, pick out the following values for each column and consume the endpoint below
   *repeat until the last component

   things to consider:
   - get the device name (using the channel ID)
   - names of the components (deviceName_comp_number)

   each device within a specific network of an oirganisation (KCCA/AirQo) has the same type of components
   - device_comp_pm2_5

   */

  let channel_id = 689761;
  let device = 689761;
  let component = "sensor_one_pm2_5";
  let time = "2020-03-05T00:00:00";
  let value = 41.01;

  const component = {};

  component.calibration = {
    sensorValue: 20,
    realValue: 13,
  };

  let calibratedValue = (value) => {
    return (sensorValue + realValue) * value;
  };

  const api = `http://34.78.78.202:31002/api/v1/devices/components/add/values?device=${device}&component=${component}`;

  // using an approporiate REST client library

  const body = {
    value: value,
    raw: value,
    weight: 1,
    frequency: "day",
    calibratedValue: calibratedValue,
    time: time,
    uncertaintyValue: 23,
    standardDeviationValue: 23,
    measurement: {
      quantityKind: "humidity",
      measurementUnit: "degrees",
    },
  };
} catch (e) {}
