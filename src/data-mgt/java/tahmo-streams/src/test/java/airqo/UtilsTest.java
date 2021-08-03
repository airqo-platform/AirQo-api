package airqo;


import airqo.models.Device;
import airqo.models.StationMeasurement;
import airqo.models.StationResponse;
import org.apache.commons.lang3.time.DateUtils;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

import static airqo.Utils.*;

public class UtilsTest {


    private static final Logger logger = LoggerFactory.getLogger(UtilsTest.class);

    static Properties properties = new Properties();

    @AfterAll
    static void tearDown() {
        logger.info("Utils tests ended");
    }

    @BeforeAll
    static void setup() {

        logger.info("Utils tests started");
        properties = loadEnvProperties("application.properties");
    }

    @Test
    public void testGetDevices(){

        List<Device> devices = getDevices(properties.getProperty("airqo.base.url"), "airqo");

        devices.forEach(device -> {
            String url = properties.getProperty("airqo.base.url") + "data/feeds/transform/recent?channel=" + device.getDevice_number();
            getMeasurements(url, device.getName(), device.getDevice_number());
        });
    }

    @Test
    public void testGetStationMeasurement(){

        Date endTime = DateUtils.addHours(new Date(System.currentTimeMillis()), -3);
        Date startTime = DateUtils.addHours(endTime, -3);

        StationResponse stationResponse = getStationMeasurements(properties, "TA00707", startTime, endTime, "Africa/Nairobi");

        List<StationMeasurement> measurements = stationResponseToMeasurements(stationResponse);

        Optional<StationMeasurement> stationTemp = measurements.stream().filter(measurement -> measurement.getVariable().equals(Variable.TEMPERATURE)).reduce((measurement1, measurement2) -> {
            if (measurement1.getTime().after(measurement2.getTime()))
                return measurement1;
            return measurement2;
        });

        Optional<StationMeasurement> stationHumidity = measurements.stream().filter(measurement -> measurement.getVariable().toString().equals("rh")).reduce((measurement1, measurement2) -> {
                    if (measurement1.getTime().after(measurement2.getTime()))
                        return measurement1;
                    return measurement2;
                });

        logger.info(stationHumidity.toString());
        logger.info(stationTemp.toString());

    }


}

//    Iterator<Map.Entry<String, String>> it = sitesStations.entrySet().iterator();
//        while (it.hasNext()) {
//                Map.Entry<String, String> station = it.next();
//        StationResponse stationResponse = getStationMeasurements(props, station.getKey(), startTime, endTime, station.getValue());
//        stationResponses.add(stationResponse);
//        it.remove();
//        }