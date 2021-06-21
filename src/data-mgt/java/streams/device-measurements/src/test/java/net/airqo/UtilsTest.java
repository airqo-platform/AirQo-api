package net.airqo;

import com.google.gson.Gson;
import net.airqo.models.*;
import org.hamcrest.CoreMatchers;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

import static org.junit.Assert.*;

public class UtilsTest {

    private static final Logger logger = LoggerFactory.getLogger(UtilsTest.class);

    List<RawAirQoMeasurement> airqoMeasurementsArrayList = new ArrayList<>();
    List<RawKccaMeasurement> kccaMeasurementsArrayList = new ArrayList<>();
    List<TransformedMeasurement> transformedMeasurements = new ArrayList<>();

    @After
    public void tearDown() {
        logger.info("Utils tests ended");
    }

    @Before
    public void setup() {

        logger.info("Utils tests started");
        airqoMeasurementsArrayList = composeAirQoInputData();
        kccaMeasurementsArrayList = composeKccaInputData();
        transformedMeasurements = composeTransformedMeasurements();
        
    }

    @Test
    public void testTransformMeasurements(){

        String measurementsString = new Gson().toJson(airqoMeasurementsArrayList);
        List<TransformedMeasurement> transformedMeasurements = Utils.transformMeasurements(measurementsString, "airqo");
        assertFalse(transformedMeasurements.isEmpty());

        measurementsString = new Gson().toJson(kccaMeasurementsArrayList);
        transformedMeasurements = Utils.transformMeasurements(measurementsString, "kcca");
        assertFalse(transformedMeasurements.isEmpty());

        transformedMeasurements = Utils.transformMeasurements(measurementsString, "invalid tenant");
        assertTrue(transformedMeasurements.isEmpty());
    }

    @Test
    public void testToTransformedDeviceMeasurements(){

        TransformedDeviceMeasurements deviceMeasurements = Utils.generateTransformedOutput(transformedMeasurements);
        assertFalse(deviceMeasurements.getMeasurements().isEmpty());
        
        Measurement measurement = deviceMeasurements.getMeasurements().get(0);
        TransformedMeasurement transformedMeasurement = transformedMeasurements.get(0);
        
        assertEquals(measurement.getDevice(), transformedMeasurement.getDevice());
        assertEquals(measurement.getFrequency(), transformedMeasurement.getFrequency());
        assertEquals(measurement.getTime(), transformedMeasurement.getTime());
        assertEquals(measurement.getTenant(), transformedMeasurement.getTenant());

        assertEquals(measurement.getLocation().getLatitude(), transformedMeasurement.getLocation().get("latitude").get("value"));
        assertEquals(measurement.getLocation().getLongitude(), transformedMeasurement.getLocation().get("longitude").get("value"));

        assertEquals(measurement.getInternalTemperature().getValue(), transformedMeasurement.getInternalTemperature().get("value"));

        assertEquals(measurement.getInternalHumidity().getValue(), transformedMeasurement.getInternalHumidity().get("value"));

        assertEquals(measurement.getPm10().getValue(), transformedMeasurement.getPm10().get("value"));
        assertEquals(measurement.getPm10().getCalibratedValue(), transformedMeasurement.getPm10().get("calibratedValue"));

        assertEquals(measurement.getPm25().getValue(), transformedMeasurement.getPm2_5().get("value"));
        assertEquals(measurement.getPm25().getCalibratedValue(), transformedMeasurement.getPm2_5().get("calibratedValue"));

        assertEquals(measurement.getNo2().getValue(), transformedMeasurement.getNo2().get("value"));
        assertEquals(measurement.getNo2().getCalibratedValue(), transformedMeasurement.getNo2().get("calibratedValue"));

        assertEquals(measurement.getPm1().getValue(), transformedMeasurement.getPm1().get("value"));
        assertEquals(measurement.getPm1().getCalibratedValue(), transformedMeasurement.getPm1().get("calibratedValue"));

    }
    
    @Test
    public void testTransformAirQoMeasurements(){

        String measurementsString = new Gson().toJson(airqoMeasurementsArrayList);

        RawAirQoMeasurement rawMeasurements = airqoMeasurementsArrayList.get(0);

        List<TransformedMeasurement> transformedMeasurements = Utils.transformAirQoMeasurements(measurementsString);

        assertEquals(transformedMeasurements.get(0).getTime(), rawMeasurements.getTime());
        assertEquals(transformedMeasurements.get(0).getFrequency().trim().toLowerCase(), "raw");
        assertEquals(transformedMeasurements.get(0).getDevice(), rawMeasurements.getDevice());
        assertEquals(transformedMeasurements.get(0).getTenant().trim().toLowerCase(), "airqo");

        assertEquals(transformedMeasurements.get(0).getInternalHumidity().get("value"), Utils.stringToDouble(rawMeasurements.getInternalHumidity()));
        assertEquals(transformedMeasurements.get(0).getInternalTemperature().get("value"), Utils.stringToDouble(rawMeasurements.getInternalTemperature()));

        assertEquals(transformedMeasurements.get(0).getPm2_5().get("value"), Utils.stringToDouble(rawMeasurements.getPm25()));
//        assertNotNull(transformedMeasurements.get(0).getPm2_5().get("calibratedValue"));

        assertEquals(transformedMeasurements.get(0).getPm10().get("value"), Utils.stringToDouble(rawMeasurements.getPm10()));

        assertEquals(transformedMeasurements.get(0).getS2_pm2_5().get("value"), Utils.stringToDouble(rawMeasurements.getS2Pm25()));
        assertEquals(transformedMeasurements.get(0).getS2_pm10().get("value"), Utils.stringToDouble(rawMeasurements.getS2Pm10()));

        assertEquals(transformedMeasurements.get(0).getBattery().get("value"), Utils.stringToDouble(rawMeasurements.getBattery()));
        assertEquals(transformedMeasurements.get(0).getSatellites().get("value"), Utils.stringToDouble(rawMeasurements.getSatellites()));
        assertEquals(transformedMeasurements.get(0).getHdop().get("value"), Utils.stringToDouble(rawMeasurements.getHdop()));

        assertEquals(transformedMeasurements.get(0).getSpeed().get("value"), Utils.stringToDouble(rawMeasurements.getSpeed()));
        assertEquals(transformedMeasurements.get(0).getAltitude().get("value"), Utils.stringToDouble(rawMeasurements.getAltitude()));

        assertEquals(transformedMeasurements.get(0).getLocation().get("latitude").get("value"), Utils.stringToDouble(rawMeasurements.getLatitude()));
        assertEquals(transformedMeasurements.get(0).getLocation().get("longitude").get("value"), Utils.stringToDouble(rawMeasurements.getLongitude()));

    }

    @Test
    public void testAddAirQoCalibratedValues(){

        TransformedMeasurement transformedMeasurement = new TransformedMeasurement(){{
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

        List<TransformedMeasurement> transformedMeasurements = new ArrayList<>();

        transformedMeasurements.add(transformedMeasurement);

        transformedMeasurements = Utils.addAirQoCalibratedValues(transformedMeasurements);

        transformedMeasurements.forEach(measurement -> {
            assertNotNull(measurement.getPm2_5().get("calibratedValue"));
        });
    }

    @Test
    public void testTransformKccaMeasurements(){

        String measurementsString = new Gson().toJson(kccaMeasurementsArrayList);
        RawKccaMeasurement rawMeasurements = kccaMeasurementsArrayList.get(0);

        List<TransformedMeasurement> transformedMeasurements = Utils.transformKccaMeasurements(measurementsString);

        assertEquals(transformedMeasurements.get(0).getTime(), rawMeasurements.getTime());
        assertEquals(transformedMeasurements.get(0).getFrequency().trim().toLowerCase(), rawMeasurements.getAverage());
        assertEquals(transformedMeasurements.get(0).getDevice(), rawMeasurements.getDeviceCode());
        assertEquals(transformedMeasurements.get(0).getTenant().trim().toLowerCase(), "kcca");

        assertEquals(transformedMeasurements.get(0).getInternalHumidity().get("value"), rawMeasurements.getCharacteristics().get("relHumid").get("value"));
        assertEquals(transformedMeasurements.get(0).getInternalHumidity().get("calibratedValue"), rawMeasurements.getCharacteristics().get("relHumid").get("calibratedValue"));

        assertEquals(transformedMeasurements.get(0).getInternalTemperature().get("value"), rawMeasurements.getCharacteristics().get("temperature").get("raw"));

        assertEquals(transformedMeasurements.get(0).getPm2_5().get("value"), rawMeasurements.getCharacteristics().get("pm2_5ConcMass").get("value"));
        assertEquals(transformedMeasurements.get(0).getPm2_5().get("calibratedValue"), rawMeasurements.getCharacteristics().get("pm2_5ConcMass").get("calibratedValue"));

        assertEquals(transformedMeasurements.get(0).getPm10().get("value"),  rawMeasurements.getCharacteristics().get("pm10ConcMass").get("value"));
        assertEquals(transformedMeasurements.get(0).getPm10().get("calibratedValue"),  rawMeasurements.getCharacteristics().get("pm10ConcMass").get("calibratedValue"));

        assertEquals(transformedMeasurements.get(0).getNo2().get("value"), rawMeasurements.getCharacteristics().get("no2Conc").get("value"));
        assertEquals(transformedMeasurements.get(0).getNo2().get("calibratedValue"), rawMeasurements.getCharacteristics().get("no2Conc").get("value"));

        assertEquals(transformedMeasurements.get(0).getPm1().get("value"),  rawMeasurements.getCharacteristics().get("pm1ConcMass").get("value"));
        assertEquals(transformedMeasurements.get(0).getPm1().get("calibratedValue"),  rawMeasurements.getCharacteristics().get("pm1ConcMass").get("value"));
    }

    @Test
    public void testLoadPropertiesFile(){

        Properties properties = Utils.loadPropertiesFile("invalid.file.properties");
        assertNotNull(properties);

        properties = Utils.loadPropertiesFile("test.application.properties");
        assertNotNull(properties.getProperty("properties.test.value"));

        properties = Utils.loadPropertiesFile(null);
        assertNotNull(properties);

    }

    @Test
    public void testStringToDouble(){

        Object object = Utils.stringToDouble("invalid double");
        assertEquals(object, "null");

        object = Utils.stringToDouble("0.0");
        assertEquals(object, 0.0);

    }

    @Test
    public void testObjectToDouble(){

        double aDouble = Utils.objectToDouble("90.0");
        assertThat(aDouble, CoreMatchers.equalTo(90.0));
        
        aDouble = Utils.objectToDouble("invalid double");
        assertThat(aDouble, CoreMatchers.equalTo(0.0));
    }


    public static List<TransformedMeasurement> composeTransformedMeasurements(){
        List<TransformedMeasurement> transformedMeasurementArrayList = new ArrayList<>();
       
        TransformedMeasurement transformedMeasurement = new TransformedMeasurement();
        
        transformedMeasurement.setDevice("device");
        transformedMeasurement.setFrequency("daily");
        transformedMeasurement.setChannelID(1);
        transformedMeasurement.setTenant("airqo");
        transformedMeasurement.setTime("2020-01-01T00:00:00Z");
        transformedMeasurement.setLocation(new HashMap<String, HashMap<String, Object>>(){{
            put("latitude", new HashMap<String, Object>(){{
                put("value", 0.2);
            }});
            put("longitude", new HashMap<String, Object>(){{
                put("value", 0.4);
            }});
        }});
        transformedMeasurement.setInternalTemperature(new HashMap<String, Object>(){{
            put("value", 0.2);
            put("calibratedValue", 0.4);
        }});
        transformedMeasurement.setAltitude(new HashMap<String, Object>(){{
            put("value", 0.2);
            put("calibratedValue", 0.4);
        }});
        transformedMeasurement.setInternalHumidity(new HashMap<String, Object>(){{
            put("value", 0.2);
            put("calibratedValue", 0.4);
        }});
        transformedMeasurement.setBattery(new HashMap<String, Object>(){{
            put("value", 0.2);
            put("calibratedValue", 0.4);
        }});
        transformedMeasurement.setSpeed(new HashMap<String, Object>(){{
            put("value", 0.2);
            put("calibratedValue", 0.4);
        }});
        transformedMeasurement.setSatellites(new HashMap<String, Object>(){{
            put("value", 0.2);
            put("calibratedValue", 0.4);
        }});
        transformedMeasurement.setHdop(new HashMap<String, Object>(){{
            put("value", 0.2);
            put("calibratedValue", 0.4);
        }});
        transformedMeasurement.setPm10(new HashMap<String, Object>(){{
            put("value", 0.2);
            put("calibratedValue", 0.4);
        }});
        transformedMeasurement.setPm2_5(new HashMap<String, Object>(){{
            put("value", 0.2);
            put("calibratedValue", 0.4);
        }});
        transformedMeasurement.setS2_pm2_5(new HashMap<String, Object>(){{
            put("value", 0.2);
            put("calibratedValue", 0.4);
        }});
        transformedMeasurement.setS2_pm10(new HashMap<String, Object>(){{
            put("value", 0.2);
            put("calibratedValue", 0.4);
        }});
        transformedMeasurement.setNo2(new HashMap<String, Object>(){{
            put("value", 0.2);
            put("calibratedValue", 0.4);
        }});
        transformedMeasurement.setPm1(new HashMap<String, Object>(){{
            put("value", 0.2);
            put("calibratedValue", 0.4);
        }});

        transformedMeasurementArrayList.add(transformedMeasurement);


        TransformedMeasurement transformedMeasurementNull = new TransformedMeasurement();
        transformedMeasurementNull.setInternalHumidity(new HashMap<>());
        transformedMeasurementNull.setPm1(new HashMap<>());

        transformedMeasurementArrayList.add(transformedMeasurementNull);

        return transformedMeasurementArrayList;
    }
    
    public static List<RawKccaMeasurement> composeKccaInputData(){
        List<RawKccaMeasurement> rawMeasurementsArrayList = new ArrayList<>();
        RawKccaMeasurement rawMeasurements = new RawKccaMeasurement();

        List<Double> coordinates = new ArrayList<>();
        coordinates.add(0.1);
        coordinates.add(0.2);

        HashMap<String, Object> location = new HashMap<String, Object>(){{
            put("coordinates", coordinates);
        }};

        HashMap<String, HashMap<String, Double>> xtics = new HashMap<String, HashMap<String, Double>>(){{
            put("temperature", new HashMap<String, Double>() {{
                put("raw", 0.0);
                put("value", 0.0);
            }});

            put("pm1ConcMass", new HashMap<String, Double>() {{
                put("raw", 0.0);
                put("value", 0.0);
            }});

            put("no2Conc", new HashMap<String, Double>() {{
                put("raw", 0.0);
                put("value", 0.0);
            }});

            put("pm2_5ConcMass", new HashMap<String, Double>() {{
                put("raw", 0.0);
                put("value", 0.0);
                put("calibratedValue", 0.0);
            }});

            put("pm10ConcMass", new HashMap<String, Double>() {{
                put("raw", 0.0);
                put("value", 0.0);
                put("calibratedValue", 0.0);
            }});

            put("relHumid", new HashMap<String, Double>() {{
                put("raw", 0.0);
                put("value", 0.0);
                put("calibratedValue", 0.0);
            }});
        }};

        rawMeasurements.setAverage("hour");
        rawMeasurements.setDevice("device");
        rawMeasurements.setLocation(location);
        rawMeasurements.setDeviceCode("deviceCode");
        rawMeasurements.setTime("2020-01-01T00:00:00Z");
        rawMeasurements.setCharacteristics(xtics);

        rawMeasurementsArrayList.add(rawMeasurements);

        return rawMeasurementsArrayList;
    }

    public static List<RawAirQoMeasurement> composeAirQoInputData(){
        List<RawAirQoMeasurement> rawMeasurementsArrayList = new ArrayList<>();
        RawAirQoMeasurement rawMeasurements = new RawAirQoMeasurement();

        rawMeasurements.setDevice("device");
        rawMeasurements.setChannelId("123493");
        rawMeasurements.setTime("2020-01-01T00:00:00Z");
        rawMeasurements.setPm25("53.12");
        rawMeasurements.setPm10("34.21");
        rawMeasurements.setS2Pm25("52.65");
        rawMeasurements.setS2Pm10("78.45");
        rawMeasurements.setLatitude("902.3");
        rawMeasurements.setLongitude("72.10");
        rawMeasurements.setBattery("12.09");
        rawMeasurements.setSpeed("45.83");
        rawMeasurements.setSatellites("73.63");
        rawMeasurements.setHdop("25.49");
        rawMeasurements.setAltitude("677.0");
        rawMeasurements.setInternalHumidity("91.27");
        rawMeasurements.setInternalTemperature("30.40");
        rawMeasurements.setExternalHumidity("897.27");
        rawMeasurements.setExternalTemperature("765.40");
        rawMeasurements.setExternalPressure(null);


        rawMeasurementsArrayList.add(rawMeasurements);

        return rawMeasurementsArrayList;
    }

}
