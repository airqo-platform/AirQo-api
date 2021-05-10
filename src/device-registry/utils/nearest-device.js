const { logElement } = require("./log");

const nearestDevices = {

    findNearestDevices: ( devices, radius, latitude, longitude ) => {
        
        try {

            let nearest_devices = []

            devices.forEach(device => {

                if ('latitude' in device && 'longitude' in device && device['isActive'] == true) {
                    distance = nearestDevices.calculateDistance(latitude, longitude, device['latitude'], device['longitude']);

                    if (distance < radius) {
                        logElement("Found a node ", distance);
                        device['distance'] = radius;
                        nearest_devices.push(device);
                    }
                }
          
            });

            return nearest_devices;
        } catch (error) {
            logElement("error", error);
        }
    },

    calculateDistance: ( latitude1, longitude1, latitude2, longitude2) => {
        
        // getting distance between latitudes and longitudes
        const latitudeDisatnce = nearestDevices.degreesToRadians(latitude2 - latitude1);
        const longitudeDisatnce = nearestDevices.degreesToRadians(longitude2 - longitude1);
  
        // converting degrees to radians
        latitude1 = nearestDevices.degreesToRadians(latitude1);
        latitude2 = nearestDevices.degreesToRadians(latitude2);
  
        // Applying Haversine formula
        const haversine = Math.pow(
          Math.sin(latitudeDisatnce / 2), 2) + 
          Math.pow(Math.sin(longitudeDisatnce / 2), 2) * 
          Math.cos(latitude1) * 
          Math.cos(latitude2);
  
        // Earth's radius in kilometers
        const radius = 6371;
  
        const c = 2 * Math.asin(Math.sqrt(haversine));
        return radius * c;
    },

    degreesToRadians: ( degrees ) => {
        
        const pi = Math.PI;
        return degrees * (pi/180);
    },
}
module.exports = nearestDevices;
