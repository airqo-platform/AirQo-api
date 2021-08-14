package net.airqo.connectors;

import net.airqo.models.AirqoDevice;
import org.junit.jupiter.api.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Properties;

import static net.airqo.connectors.Utils.getDevices;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class UtilsTest {


    private static final Logger logger = LoggerFactory.getLogger(UtilsTest.class);

    Properties testProperties = new Properties();
    private String airqoBaseUrl;

    @AfterAll
    public void tearDown() {
    }

    @BeforeAll
    public void setUp(){
        try {
            testProperties.load(VersionUtil.class.getClassLoader().getResourceAsStream("application.properties"));
            logger.info("\nApplication properties have been loaded\n");
            airqoBaseUrl = testProperties.getProperty("airqo.base.url", null);
        } catch (Exception e) {
            logger.error("Unable to load properties from application.properties.", e);
        }

    }

    @Test
    public void testGetMeasurements(){

    }

    @Test
    public void testGetDevices(){
        List<AirqoDevice> devices =  getDevices(airqoBaseUrl);
        Assertions.assertFalse(devices.isEmpty());
    }
}
