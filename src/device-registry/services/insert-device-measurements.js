const { transformMeasurements } = require("../utils/transform-measurements");
const insertMeasurements = require("../utils/insert-measurements");
const { doesDeviceExist } = require("../utils/does-component-exist");


const insertDeviceMeasurements = {

    // Contains modules that provide various ways to insert device measurements.
    
    addValuesArray: async (array_data) => {

        logObject("Measurements Data", array_data);

        let returnResponse = [];

        try {

            for (index in array_data) {

                const data = array_data[index];

                const device = data.device;
                const tenant = data.tenant;
                const measurements = [data];

                if (!tenant || !device || !measurements.length <= 2) {

                    returnResponse.push({
                        success: false,
                        message: "Missing values...",
                        errors: [],
                        valuesRejected: data,
                        valuesAdded: [],

                    });

                    continue;

                }

                const isDevicePresent = await doesDeviceExist(
                    device,
                    tenant.toLowerCase()
                );

                if (!isDevicePresent){
                    returnResponse.push({
                        success: false,
                        message: `Device (${device}) for tenant (${tenant}) does not exist on the network`,
                        errors: [],
                        valuesRejected: data,
                        valuesAdded: [],

                    });

                    continue;
                }

                const transformedMeasurements = await transformMeasurements(
                    device,
                    measurements
                );

                const response = await insertMeasurements(tenant, transformedMeasurements);

                returnResponse.push(response);
            }
        } 
        catch (e) {

            returnResponse.push({
                success: false,
                message: "Error Occurred...",
                errors: e,
                valuesRejected: [],
                valuesAdded: [],
            });

        }
        finally{

            return returnResponse;
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

                if(response.success == false){
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