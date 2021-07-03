const { transformMeasurements } = require("./transform-measurements");
const insertMeasurements = require("./insert-measurements");
const { doesDeviceExist } = require("./does-component-exist");
const { logObject } = require("./log");

const insertDeviceMeasurements = {

    // Contains modules that provide various ways to insert device measurements.

    addValuesArray: async (measurements_array) => {

        try {

            for (const measurement of measurements_array) {

                logObject("Kafka Measurement", measurement);

                const device = measurement.device;
                const tenant = measurement.tenant;
                const measurements = [measurement];

                if (!tenant || !device) {

                    logObject("Kafka Data insertion log", JSON.stringify({
                        success: false,
                        message: "Missing values...",
                        errors: [],
                        valuesRejected: measurements,
                        valuesAdded: [],

                    }));
                    continue;
                }

                let isDevicePresent = await doesDeviceExist(
                    device,
                    tenant.toLowerCase()
                );
                if (!isDevicePresent){
                    logObject("Kafka Data insertion log", JSON.stringify({
                        success: false,
                        message: `Device (${device}) for tenant (${tenant}) does not exist on the network`,
                        errors: [],
                        valuesRejected: measurements,
                        valuesAdded: [],

                    }));
                    continue;
                }

                let transformedMeasurements = await transformMeasurements(
                    device,
                    measurements
                );

                let response = await insertMeasurements(tenant, transformedMeasurements);
                logObject("Kafka Data insertion log", JSON.stringify(response));
            }
        } 
        catch (e) {

            logObject("Kafka Single Event Error", e);

            logObject("Kafka Data insertion log", JSON.stringify({
                success: false,
                message: "Error Occurred...",
                errors: e,
                valuesRejected: [],
                valuesAdded: [],
            }));

        }

    },

    addDeviceValues: async (device, tenant, measurements) => {

        try {

            if (tenant && device && measurements) {

                const deviceDetails = await getDetail(tenant, device);
                const deviceExists = isEmpty(deviceDetails);
    
                if (!deviceExists){
                    return {
                        success: false,
                        message: `Device (${device}) for tenant (${tenant}) does not exist on the network`,
                        errors: [],
                        valuesRejected: data,
                        valuesAdded: [],
                    }
                }

                const transformedMeasurements = await transformMeasurements(
                    device,
                    measurements
                  );

                const response = await insertMeasurements(
                    tenant,
                    transformedMeasurements
                );

                if(response.success === false){
                    return {
                        success: false,
                        message: "finished the operation with some errors",
                        errors: response.errors,
                        valuesRejected: response.valuesRejected,
                        valuesAdded: response.valuesAdded,
                      };
                }

                return response;


            } else {

                return {
                    success: false,
                    message: "misssing parameters",
                    errors: [],
                    valuesRejected: data,
                    valuesAdded: [],

                };
            }


        } 
        catch (e) {

            return {
                success: false,
                message: "Error Occurred...",
                errors: error.message,
                valuesRejected: [],
                valuesAdded: [],
            };

        }

    },
};

module.exports =  insertDeviceMeasurements;