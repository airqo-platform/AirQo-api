package net.airqo;

import com.google.gson.Gson;
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

import static org.junit.Assert.*;
import static org.junit.Assert.assertEquals;


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
            setDevice("aq_01");
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

    @Test
    public void testStringToObjectList(){

        Calibrate.CalibrateResponse calibrateResponse = new Calibrate.CalibrateResponse();
        calibrateResponse.setCalibratedValue(23.0);
        calibrateResponse.setDevice("device");

        List<Calibrate.CalibrateResponse> list = new ArrayList<>();
        list.add(calibrateResponse);

        List<Calibrate.CalibrateResponse> object = Calibrate.stringToObjectList(new Gson().toJson(list));

        assertFalse(object.isEmpty());
        assertEquals(object.get(0).getCalibratedValue(), 23.0);
        assertEquals(object.get(0).getDevice(), "device");


    }

}

