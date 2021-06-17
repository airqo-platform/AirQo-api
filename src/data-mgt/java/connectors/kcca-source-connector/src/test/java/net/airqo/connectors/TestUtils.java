package net.airqo.connectors;

import net.airqo.connectors.models.RawMeasurements;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Properties;

import static net.airqo.connectors.Utils.getMeasurements;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class TestUtils {

    private static final Logger logger = LoggerFactory.getLogger(TestUtils.class);

    Properties clarityProperties = new Properties();


    @BeforeAll
    public void setUp(){
        try {
            clarityProperties.load(VersionUtil.class.getClassLoader().getResourceAsStream("clarity.properties"));
            logger.info("\nClarity properties have been loaded\n");
        } catch (Exception e) {
            logger.error("Unable to load clarity properties from clarity.properties.", e);
        }

    }

    @Test
    public void testGetMeasurements(){

        SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd'T'00:00:00'Z'");

        String url = String.format("%smeasurements?startTime=%s",
                clarityProperties.getProperty("clarity.baseUrl", "null"),
                simpleDateFormat.format(new Date(System.currentTimeMillis() -  4 * 3600 * 1000))
        );

        List<RawMeasurements> measurements =  getMeasurements(
                url,
                clarityProperties.getProperty("clarity.apiKey", "null"));

        Assertions.assertFalse(measurements.isEmpty());

    }
}
