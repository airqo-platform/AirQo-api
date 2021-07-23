package airqo;


import airqo.models.Device;
import org.junit.After;
import org.junit.Before;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Properties;

import static airqo.Utils.*;

public class UtilsTest {


    private static final Logger logger = LoggerFactory.getLogger(UtilsTest.class);

    Properties properties = new Properties();

    @After
    public void tearDown() {
        logger.info("Utils tests ended");
    }

    @Before
    public void setup() {

        logger.info("Utils tests started");
        properties = loadPropertiesFile("application.properties");

    }

    @Test
    public void testGetDevices(){

        String baseUrl = properties.getProperty("airqo.base.url");
        logger.info(baseUrl);
        List<Device> devices = getDevices("https://staging-platform.airqo.net/api/v1/", "airqo");

        devices.forEach(device -> {
            String url = "http://34.78.78.202:31001/api/v1/data/feeds/transform/recent?channel=" + device.getDevice_number();
            getMeasurements(url, device.getName(), device.getDevice_number());
        });
    }
}
