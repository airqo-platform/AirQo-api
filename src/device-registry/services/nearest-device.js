const { logElement } = require("../utils/log");

const nearestDevices = {

    findNearestDevices: ( devices, latitude, longitude ) => {
        
        try {

            let nearest_devices = []

            devices.forEach(device => {

                if ('latitude' in device && 'longitude' in device && device['isActive'] == true) {
                    distance = nearestDevices.calculateDistance(latitude, longitude, device['latitude'], device['longitude']);

                    if (distance < 1) {
                        logElement("Found a node ", distance);
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
        
        // distance between latitudes and longitudes
        var latitudeDisatnce = nearestDevices.degreesToRadians(latitude2 - latitude1);
        var longitudeDisatnce = nearestDevices.degreesToRadians(longitude2 - longitude1);
  
        // convert to radians
        latitude1 = nearestDevices.degreesToRadians(latitude1);
        latitude2 = nearestDevices.degreesToRadians(latitude2);
  
        // Applying Haversine formula
        a = Math.pow(
          Math.sin(latitudeDisatnce / 2), 2) + 
          Math.pow(Math.sin(longitudeDisatnce / 2), 2) * 
          Math.cos(latitude1) * 
          Math.cos(latitude2);
  
        // Earth's radius in kilometers
        var radius = 6371;
  
        var c = 2 *Math.asin(Math.sqrt(a));
        return radius * c;
    },

    degreesToRadians: ( degrees ) => {
        
        var pi = Math.PI;
        return degrees * (pi/180);
    },
}
module.exports = nearestDevices;
