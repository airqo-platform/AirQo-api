// const { transformMeasurements, bulkTransformMeasurements } = require("../utils/transform-measurements");
// const { bulkInsert } = require("../utils/insert-measurements");
// const { doesDeviceExist, doDevicesExist } = require("../utils/does-component-exist");
// const { logObject } = require("../utils/log");

// const bulkInserts = (measurements) => {

//     const valid_measurements = doDevicesExist(measurements);

//     let transformedMeasurements = await bulkTransformMeasurements(valid_measurements);

//     let response = await bulkInsert(transformedMeasurements);
//     logObject("Kafka Data insertion log", JSON.stringify(response));


//     addValuesArray: async (measurements_array) => {

//         try {

//             for (let index in measurements_array) {

//                 const data = array_data[index];

//                 const device = data.device;
//                 const tenant = data.tenant;
//                 const measurements = [data];

//                 if (!tenant || !device) {

//                     logObject("Kafka Data insertion log", JSON.stringify({
//                         success: false,
//                         message: "Missing values...",
//                         errors: [],
//                         valuesRejected: data,
//                         valuesAdded: [],

//                     }));

//                     continue;

//                 }

//                 let isDevicePresent = await doesDeviceExist(
//                     device,
//                     tenant.toLowerCase()
//                 );

//                 if (!isDevicePresent){
//                     logObject("Kafka Data insertion log", JSON.stringify({
//                         success: false,
//                         message: `Device (${device}) for tenant (${tenant}) does not exist on the network`,
//                         errors: [],
//                         valuesRejected: data,
//                         valuesAdded: [],
//                     }));

//                     continue;
//                 }

//                 let transformedMeasurements = await transformMeasurements(
//                     device,
//                     measurements
//                 );

//                 let response = await insertMeasurements(tenant, transformedMeasurements);
//                 logObject("Kafka Data insertion log", JSON.stringify(response));

//             }
//         } 
//         catch (e) {

//             logObject("Kafka Data insertion log", JSON.stringify({
//                 success: false,
//                 message: "Error Occurred...",
//                 errors: e,
//                 valuesRejected: [],
//                 valuesAdded: [],
//             }));

//         }

//     },

//     async (measurements_array) => {

//         try {

//             for (let index in measurements_array) {

//                 const data = array_data[index];

//                 const device = data.device;
//                 const tenant = data.tenant;
//                 const measurements = [data];

//                 if (!tenant || !device) {

//                     logObject("Kafka Data insertion log", JSON.stringify({
//                         success: false,
//                         message: "Missing values...",
//                         errors: [],
//                         valuesRejected: data,
//                         valuesAdded: [],

//                     }));

//                     continue;

//                 }

//                 let isDevicePresent = await doesDeviceExist(
//                     device,
//                     tenant.toLowerCase()
//                 );

//                 if (!isDevicePresent){
//                     logObject("Kafka Data insertion log", JSON.stringify({
//                         success: false,
//                         message: `Device (${device}) for tenant (${tenant}) does not exist on the network`,
//                         errors: [],
//                         valuesRejected: data,
//                         valuesAdded: [],
//
//                     }));

//                     continue;
//                 }

//                 let transformedMeasurements = await transformMeasurements(
//                     device,
//                     measurements
//                 );

//                 let response = await insertMeasurements(tenant, transformedMeasurements);
//                 logObject("Kafka Data insertion log", JSON.stringify(response));

//             }
//         } 
//         catch (e) {

//             logObject("Kafka Data insertion log", JSON.stringify({
//                 success: false,
//                 message: "Error Occurred...",
//                 errors: e,
//                 valuesRejected: [],
//                 valuesAdded: [],
//             }));

//         }

//     },

// ;

// module.exports =   bulkInsert;