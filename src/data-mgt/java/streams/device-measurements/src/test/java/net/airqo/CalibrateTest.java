package net.airqo;

import com.google.gson.Gson;
import net.airqo.models.TransformedMeasurement;
import net.airqo.models.TransformedValue;
import org.junit.jupiter.api.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.fail;


@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class CalibrateTest {

    private static final Logger logger = LoggerFactory.getLogger(CalibrateTest.class);
    TransformedMeasurement transformedMeasurement;
    private String urlString;

    @AfterAll
    public void tearDown() {
        logger.info("Calibrate tests ended");
    }

    @BeforeAll
    public void setup() {

        String propertiesUrlFile = "application.properties";
        Properties props = Utils.loadPropertiesFile(propertiesUrlFile);
        urlString = props.getProperty("calibrate.url", null);

        logger.info("Calibrate tests started");
        transformedMeasurement = new TransformedMeasurement(){{
            setTime("2021-04-11T12:00:00Z");
            setDevice("aq_01");
            setPm2_5(new TransformedValue(){{
                setValue(32.6);
            }});
            setPm10(new TransformedValue(){{
                setValue(34.6);
            }});
            setInternalTemperature(new TransformedValue(){{
                setValue(89.6);
            }});
            setInternalHumidity(new TransformedValue(){{
                setValue(12.6);
            }});
        }};
    }

    @Test
    public void testGetCalibratedValue(){

        assertThrows(IOException.class, () -> Calibrate.getCalibratedValue(transformedMeasurement, ""));
        assertThrows(IOException.class, () -> Calibrate.getCalibratedValue(transformedMeasurement, "test.empty.properties"));
        assertThrows(IOException.class, () -> Calibrate.getCalibratedValue(null, urlString));
        assertThrows(IOException.class, () -> Calibrate.getCalibratedValue(transformedMeasurement, null));

        try {
            Object object = Calibrate.getCalibratedValue(transformedMeasurement, urlString);
            Assertions.assertNotNull(object);

        } catch (IOException e) {
            e.printStackTrace();
            fail();
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

        Assertions.assertFalse(object.isEmpty());
        Assertions.assertEquals(object.get(0).getCalibratedValue(), 23.0);
        Assertions.assertEquals(object.get(0).getDevice(), "device");


    }

}

