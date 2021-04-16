const { transformMeasurements } = require("../utils/transform-measurements");
const insertMeasurements = require("../utils/insert-measurements");
const { doesDeviceExist } = require("../utils/does-component-exist");


const createEvent = {

    // Groups mulitple modules needed to insert an array of device measurements
    
    addValues: async (array_data) => {

        logObject("Measurements Data", array_data);

        let returnResponse = [];

        try {

            for (index in array_data) {

                const data = array_data[index];

                const device = data.device;
                const tenant = data.tenant;
                const measurements = [data];

                if (tenant && device && measurements.length > 2) {

                    const isDevicePresent = await doesDeviceExist(
                        device,
                        tenant.toLowerCase()
                    );

                    if (isDevicePresent) {

                        const transformedMeasurements = await transformMeasurements(
                            device,
                            measurements
                        );

                        const response = await insertMeasurements(tenant, transformedMeasurements);

                        returnResponse.push(response);

                    } else {
                        returnResponse.push({
                            success: false,
                            message: `Device (${device}) for tenant (${tenant}) does not exist on the network`,
                            errors: [],
                            valuesRejected: data,
                            valuesAdded: [],

                        });
                    }

                } else {

                    returnResponse.push({
                        success: false,
                        message: "Missing values...",
                        errors: [],
                        valuesRejected: data,
                        valuesAdded: [],

                    });
                }

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
};

module.exports = {
    createEvent,
};