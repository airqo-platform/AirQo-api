const { logElement } = require("../utils/log");

const nearestDevices = {

    findNearestDevices: ( devices, lat, lng ) => {
        
        try {

            let nearest_devices = []

            devices.forEach(device => {

                if ('latitude' in device && 'longitude' in device && device['isActive'] == true) {
                    distance = nearestDevices.calculateDistance(lat, lng, device['latitude'], device['longitude']);

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

    calculateDistance: ( lat1, lng1, lat2, lng2) => {
        
        // distance between latitudes and longitudes
        var latitudeDisatnce = nearestDevices.degreesToRadians(lat2 - lat1);
        var longitudeDisatnce = nearestDevices.degreesToRadians(lng2 - lng1);
  
        // convert to radians
        lat1 = nearestDevices.degreesToRadians(lat1);
        lat2 = nearestDevices.degreesToRadians(lat2);
  
        // Applying Haversine formula
        a = Math.pow(
          Math.sin(latitudeDisatnce / 2), 2) + 
          Math.pow(Math.sin(longitudeDisatnce / 2), 2) * 
          Math.cos(lat1) * 
          Math.cos(lat2);
  
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
