const iot = require('@google-cloud/iot');
const client = new iot.v1.DeviceManagerClient();
const constants = require('./constants');

async function initiate() {
    const projectId = await client.getProjectId();
    const parent = client.locationPath(projectId, 'europe-west1');
    const [resources] = await client.listDeviceRegistries({ parent });
    console.log(`${resources.length} resource(s) found`);

    for (const resource of resources) {
        console.log(resource);
    }
}

initiate();