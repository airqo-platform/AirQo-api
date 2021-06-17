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
import java.util.TimeZone;

import static net.airqo.connectors.Utils.getMeasurements;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class TestUtils {

    private static final Logger logger = LoggerFactory.getLogger(TestUtils.class);

    Properties clarityProperties = new Properties();

//    @BeforeAll
//    public void setUp(){
//        try {
//            clarityProperties.load(VersionUtil.class.getClassLoader().getResourceAsStream("clarity.properties"));
//            logger.info("\nClarity properties have been loaded\n");
//        } catch (Exception e) {
//            logger.error("Unable to load clarity properties from clarity.properties.", e);
//        }
//
//    }
//
//    @Test
//    public void testBuildQueryParameters(){
//
//        // testing hour average
//        SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd'T'hh:00:00'Z'");
//        simpleDateFormat.setTimeZone(TimeZone.getTimeZone("UTC"));
//        String startTime =  simpleDateFormat.format(new Date(System.currentTimeMillis() - 2 * 3600 * 1000 ));
//
//        String params = Utils.buildQueryParameters("hour");
//        Assertions.assertEquals(String.format("?startTime=%s&average=hour", startTime), params);
//
//        // testing day average
//        simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd'T'00:00:00'Z'");
//        simpleDateFormat.setTimeZone(TimeZone.getTimeZone("UTC"));
//        startTime =  simpleDateFormat.format(new Date(System.currentTimeMillis() - 48 * 3600 * 1000));
//
//        params = Utils.buildQueryParameters("day");
//        Assertions.assertEquals(String.format("?startTime=%s&average=day", startTime), params);
//
//        // testing invalid/raw average
//        simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd'T'hh:mm:00'Z'");
//        simpleDateFormat.setTimeZone(TimeZone.getTimeZone("UTC"));
//        startTime =  simpleDateFormat.format(new Date(System.currentTimeMillis() - 1800 * 1000));
//
//        params = Utils.buildQueryParameters("invalid");
//        Assertions.assertEquals(String.format("?startTime=%s", startTime), params);
//
//    }
//
//    @Test
//    public void testGetMeasurements(){
//
//        SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd'T'00:00:00'Z'");
//
//        String url = String.format("%smeasurements?startTime=%s",
//                clarityProperties.getProperty("clarity.baseUrl", "null"),
//                simpleDateFormat.format(new Date(System.currentTimeMillis() -  4 * 3600 * 1000))
//        );
//
//        List<RawMeasurements> measurements =  getMeasurements(
//                url,
//                clarityProperties.getProperty("clarity.apiKey", "null"));
//
//        Assertions.assertFalse(measurements.isEmpty());
//
//    }
}
