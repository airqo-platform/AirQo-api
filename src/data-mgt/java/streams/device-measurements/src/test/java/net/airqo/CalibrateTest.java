package net.airqo;

import net.airqo.models.RawAirQoMeasurement;
import net.airqo.models.RawKccaMeasurement;
import net.airqo.models.TransformedMeasurement;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

import static org.junit.Assert.assertNotNull;


public class CalibrateTest {

    private static final Logger logger = LoggerFactory.getLogger(CalibrateTest.class);
    TransformedMeasurement transformedMeasurement;

    @After
    public void tearDown() {
        logger.info("Calibrate tests ended");
    }

    @Before
    public void setup() {

        logger.info("Calibrate tests started");
        transformedMeasurement = new TransformedMeasurement(){{
            setDevice("device id");
            setPm2_5(new HashMap<String, Object>(){{
                put("value", 34.6);
            }});
            setPm10(new HashMap<String, Object>(){{
                put("value", 67.34);
            }});
            setInternalTemperature(new HashMap<String, Object>(){{
                put("value", 37.6);
            }});
            setInternalHumidity(new HashMap<String, Object>(){{
                put("value", 34.67);
            }});
        }};
    }

    @Test
    public void testGetCalibratedValue(){

        try {
            Object object = Calibrate.getCalibratedValue(transformedMeasurement, "");
            assertNotNull(object);

        } catch (IOException e) {
            logger.error("Calibrate error : {}", e.toString());
        }

        try {
            Object object = Calibrate.getCalibratedValue(transformedMeasurement, "invalid.file.properties");
            assertNotNull(object);

        } catch (IOException e) {
            logger.error("Calibrate error : {}", e.toString());
        }

        try {

            Object object = Calibrate.getCalibratedValue(transformedMeasurement, "test.empty.properties");
            assertNotNull(object);


        } catch (IOException e) {
            logger.error("Calibrate error : {}", e.toString());
        }

        try {

            Object object = Calibrate.getCalibratedValue(null, null);
            assertNotNull(object);

        } catch (IOException e) {
            logger.error("Calibrate error : {}", e.toString());
        }
    }
}
