package airqo;

import airqo.models.*;
import com.google.gson.Gson;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.jupiter.api.Assertions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

import static airqo.Utils.*;
import static org.junit.Assert.*;

public class UtilsTest {


    private static final Logger logger = LoggerFactory.getLogger(UtilsTest.class);

    List<RawAirQoMeasurement> airqoMeasurementsArrayList = new ArrayList<>();
    List<RawKccaMeasurement> kccaMeasurementsArrayList = new ArrayList<>();
    List<TransformedMeasurement> transformedMeasurements = new ArrayList<>();
    Properties properties = new Properties();

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
        properties = loadEnvProperties("test.application.properties");

    }

    @Test
    public void testGetDevices(){

        String baseUrl = properties.getProperty("airqo.base.url");

        Map<String, String> invalidOptions = new HashMap<>(){{
            put("invalid", "kcca");
            put(baseUrl, null);
            put(baseUrl, "invalidTenant");
            put(null, null);
        }};

        invalidOptions.forEach((url, tenant) -> {
            List<Device> devices = getDevices(url, tenant);
            Assertions.assertTrue(devices.isEmpty());
        });

        Map<String, String> validOptions = new HashMap<>(){{
            put(baseUrl, "airqo");
            put(baseUrl, "kcca");
        }};

        validOptions.forEach((url, tenant) -> {
            List<Device> devices = getDevices(url, tenant);
            Assertions.assertFalse(devices.isEmpty());
        });

    }


    @Test
    public void testGetFrequency(){

        Assertions.assertEquals(getFrequency("RAW"), "raw");
        Assertions.assertEquals(getFrequency("1"), "raw");
        Assertions.assertEquals(getFrequency(null), "raw");
        Assertions.assertEquals(getFrequency("daY"), "daily");
        Assertions.assertEquals(getFrequency(" days "), "daily");
        Assertions.assertEquals(getFrequency("HOURLY "), "hourly");
        Assertions.assertEquals(getFrequency("hours"), "hourly");
    }

    @Test
    public void testGetDeviceByName(){
        List<Device> devices = new ArrayList<>(){{
            add(new Device(){{
                setName("device_one");
            }});
        }};

        Device device = getDeviceByName(devices, "ANYRC92F");
        Assertions.assertEquals(device.get_id(), "");
        Assertions.assertEquals(device.getSite().get_id(), "");

        device = getDeviceByName(devices, " DEVICE_ONE ");
        Assertions.assertEquals(device.getName(), "device_one");
    }

    @Test
    public void testTransformMeasurements(){

        Properties emptyProperties = new Properties();

        Assertions.assertTrue(Utils.transformMeasurements("measurementsString", emptyProperties).isEmpty());

        Properties funcProps = properties;
        funcProps.setProperty("input.topic", "airqo-raw-device-measurements-topic");
        funcProps.setProperty("tenant", "airqo");

        String measurementsString = new Gson().toJson(airqoMeasurementsArrayList);

        List<TransformedMeasurement> transformedMeasurements = Utils.transformMeasurements(measurementsString, funcProps);
        assertFalse(transformedMeasurements.isEmpty());

        measurementsString = new Gson().toJson(kccaMeasurementsArrayList);
        transformedMeasurements = Utils.transformMeasurements(measurementsString, properties);
        assertFalse(transformedMeasurements.isEmpty());

    }

    @Test
    public void testGenerateTransformedOutput(){

        TransformedDeviceMeasurements deviceMeasurements = Utils.generateTransformedOutput(transformedMeasurements);
        assertFalse(deviceMeasurements.getMeasurements().isEmpty());
        
        Measurement measurement = deviceMeasurements.getMeasurements().get(0);
        TransformedMeasurement transformedMeasurement = transformedMeasurements.get(0);
        
        assertEquals(measurement.getDevice(), transformedMeasurement.getDevice());
        assertEquals(measurement.getFrequency(), transformedMeasurement.getFrequency());
        assertEquals(measurement.getTime(), transformedMeasurement.getTime());
        assertEquals(measurement.getTenant(), transformedMeasurement.getTenant());

        assertEquals(measurement.getLocation().getLatitude(), transformedMeasurement.getLocation().getLatitude().getValue());
        assertEquals(measurement.getLocation().getLongitude(), transformedMeasurement.getLocation().getLongitude().getValue());

        assertEquals(measurement.getInternalTemperature().getValue(), transformedMeasurement.getInternalTemperature().getValue());

        assertEquals(measurement.getInternalHumidity().getValue(), transformedMeasurement.getInternalHumidity().getValue());

        assertEquals(measurement.getPm10().getValue(), transformedMeasurement.getPm10().getValue());
        assertEquals(measurement.getPm10().getCalibratedValue(), transformedMeasurement.getPm10().getCalibratedValue());

        assertEquals(measurement.getPm25().getValue(), transformedMeasurement.getPm2_5().getValue());
        assertEquals(measurement.getPm25().getCalibratedValue(), transformedMeasurement.getPm2_5().getCalibratedValue());

        assertEquals(measurement.getNo2().getValue(), transformedMeasurement.getNo2().getValue());
        assertEquals(measurement.getNo2().getCalibratedValue(), transformedMeasurement.getNo2().getCalibratedValue());

        assertEquals(measurement.getPm1().getValue(), transformedMeasurement.getPm1().getValue());
        assertEquals(measurement.getPm1().getCalibratedValue(), transformedMeasurement.getPm1().getCalibratedValue());

    }

    @Test
    public void testTransformAirQoMeasurements(){

        Assertions.assertTrue(Utils.transformAirQoMeasurements("hello world", properties).isEmpty());

        String measurementsString = new Gson().toJson(airqoMeasurementsArrayList);

        RawAirQoMeasurement rawMeasurements = airqoMeasurementsArrayList.get(0);

        List<TransformedMeasurement> transformedMeasurements = Utils.transformAirQoMeasurements(measurementsString, properties);

        assertEquals(transformedMeasurements.get(0).getTime(), rawMeasurements.getTime());
        assertEquals(transformedMeasurements.get(0).getFrequency().trim().toLowerCase(), "raw");
        assertEquals(transformedMeasurements.get(0).getDevice(), rawMeasurements.getDevice());
        assertEquals(transformedMeasurements.get(0).getTenant().trim().toLowerCase(), "airqo");

        assertEquals(transformedMeasurements.get(0).getInternalHumidity().getValue(), Utils.stringToDouble(rawMeasurements.getInternalHumidity(), false));
        assertEquals(transformedMeasurements.get(0).getInternalTemperature().getValue(), Utils.stringToDouble(rawMeasurements.getInternalTemperature(), false));

        assertEquals(transformedMeasurements.get(0).getPm2_5().getValue(), Utils.stringToDouble(rawMeasurements.getPm25(), false));
//        assertNotNull(transformedMeasurements.get(0).getPm2_5().getCalibratedValue());

        assertEquals(transformedMeasurements.get(0).getPm10().getValue(), Utils.stringToDouble(rawMeasurements.getPm10(), false));

        assertEquals(transformedMeasurements.get(0).getS2_pm2_5().getValue(), Utils.stringToDouble(rawMeasurements.getS2Pm25(), false));
        assertEquals(transformedMeasurements.get(0).getS2_pm10().getValue(), Utils.stringToDouble(rawMeasurements.getS2Pm10(), false));

        assertEquals(transformedMeasurements.get(0).getBattery().getValue(), Utils.stringToDouble(rawMeasurements.getBattery(), false));
        assertEquals(transformedMeasurements.get(0).getSatellites().getValue(), Utils.stringToDouble(rawMeasurements.getSatellites(), false));
        assertEquals(transformedMeasurements.get(0).getHdop().getValue(), Utils.stringToDouble(rawMeasurements.getHdop(), false));

        assertEquals(transformedMeasurements.get(0).getSpeed().getValue(), Utils.stringToDouble(rawMeasurements.getSpeed(), false));
        assertEquals(transformedMeasurements.get(0).getAltitude().getValue(), Utils.stringToDouble(rawMeasurements.getAltitude(), false));

        assertEquals(transformedMeasurements.get(0).getLocation().getLatitude().getValue(), Utils.stringToDouble(rawMeasurements.getLatitude(), false));
        assertEquals(transformedMeasurements.get(0).getLocation().getLongitude().getValue(), Utils.stringToDouble(rawMeasurements.getLongitude(), false));

    }

    @Test
    public void testAddAirQoCalibratedValues(){

        TransformedMeasurement transformedMeasurement = new TransformedMeasurement(){{
            setDevice("aq_01");
            setTime("2021-01-01T00:00:00Z");
            setPm2_5(new TransformedValue(){{
                setValue(34.7);
            }});
            setPm10(new TransformedValue(){{
                setValue(34.5);
            }});
            setInternalTemperature(new TransformedValue(){{
                setValue(365.44);
            }});
            setInternalHumidity(new TransformedValue(){{
                setValue(334.3);
            }});
        }};

        List<TransformedMeasurement> transformedMeasurements = new ArrayList<>();

        transformedMeasurements.add(transformedMeasurement);

        transformedMeasurements = Utils.addAirQoCalibratedValues(transformedMeasurements);

        transformedMeasurements.forEach(measurement -> {
            assertNotNull(measurement.getPm2_5().getCalibratedValue());
        });
    }

    @Test
    public void testTransformKccaMeasurements(){

        Assertions.assertTrue(Utils.transformKccaMeasurements("hello world", properties).isEmpty());

        String measurementsString = new Gson().toJson(kccaMeasurementsArrayList);
        RawKccaMeasurement rawMeasurements = kccaMeasurementsArrayList.get(0);

        List<TransformedMeasurement> transformedMeasurements = Utils.transformKccaMeasurements(measurementsString, properties);

        assertEquals(transformedMeasurements.get(0).getTime(), rawMeasurements.getTime());
        assertEquals(transformedMeasurements.get(0).getFrequency().trim().toLowerCase(), getFrequency(rawMeasurements.getAverage()));
        assertEquals(transformedMeasurements.get(0).getDevice(), rawMeasurements.getDeviceCode());
        assertEquals(transformedMeasurements.get(0).getTenant().trim().toLowerCase(), "kcca");

        assertEquals(transformedMeasurements.get(0).getInternalHumidity().getValue(), rawMeasurements.getCharacteristics().getRelHumid().getRaw());
        assertEquals(transformedMeasurements.get(0).getInternalHumidity().getCalibratedValue(), rawMeasurements.getCharacteristics().getRelHumid().getCalibratedValue());

        assertEquals(transformedMeasurements.get(0).getInternalTemperature().getValue(), rawMeasurements.getCharacteristics().getTemperature().getRaw());
        assertEquals(transformedMeasurements.get(0).getInternalTemperature().getCalibratedValue(), rawMeasurements.getCharacteristics().getTemperature().getCalibratedValue());

        assertEquals(transformedMeasurements.get(0).getPm2_5().getValue(), rawMeasurements.getCharacteristics().getPm2_5ConcMass().getRaw());
        assertEquals(transformedMeasurements.get(0).getPm2_5().getCalibratedValue(), rawMeasurements.getCharacteristics().getPm2_5ConcMass().getCalibratedValue());

        assertEquals(transformedMeasurements.get(0).getPm10().getValue(),  rawMeasurements.getCharacteristics().getPm10ConcMass().getRaw());
        assertEquals(transformedMeasurements.get(0).getPm10().getCalibratedValue(),  rawMeasurements.getCharacteristics().getPm10ConcMass().getCalibratedValue());

        assertEquals(transformedMeasurements.get(0).getNo2().getValue(), rawMeasurements.getCharacteristics().getNo2Conc().getRaw());
        assertEquals(transformedMeasurements.get(0).getNo2().getCalibratedValue(), rawMeasurements.getCharacteristics().getNo2Conc().getCalibratedValue());

        assertEquals(transformedMeasurements.get(0).getPm1().getValue(),  rawMeasurements.getCharacteristics().getPm1ConcMass().getRaw());
        assertEquals(transformedMeasurements.get(0).getPm1().getCalibratedValue(),  rawMeasurements.getCharacteristics().getPm1ConcMass().getCalibratedValue());
    }

    @Test
    public void testLoadPropertiesFile(){

        Properties properties = loadEnvProperties("invalid.file.properties");
        assertNotNull(properties);

        properties = loadEnvProperties("test.application.properties");
        assertNotNull(properties.getProperty("properties.test.value"));

        properties = loadEnvProperties("null");
        assertNotNull(properties);

    }

    @Test
    public void testStringToDouble(){

        Object object = Utils.stringToDouble("invalid double", true);
        assertNull(object);

        object = Utils.stringToDouble("0.0", true);
        assertEquals(object, 0.0);

    }


    public static List<TransformedMeasurement> composeTransformedMeasurements(){
        List<TransformedMeasurement> transformedMeasurementArrayList = new ArrayList<>();
       
        TransformedMeasurement transformedMeasurement = new TransformedMeasurement();
        
        transformedMeasurement.setDevice("device");
        transformedMeasurement.setFrequency("daily");
        transformedMeasurement.setDeviceNumber(1);
        transformedMeasurement.setTenant("airqo");
        transformedMeasurement.setTime("2020-01-01T00:00:00Z");
        transformedMeasurement.setLocation(new TransformedLocation(){{
            setLatitude(new LocationValue(0.2));
            setLongitude(new LocationValue(0.1));
        }});
        transformedMeasurement.setInternalTemperature(new TransformedValue(){{
            setValue(0.2);
            setCalibratedValue(0.4);
        }});
        transformedMeasurement.setAltitude(new TransformedValue(){{
            setValue(0.2);
            setCalibratedValue(0.4);
        }});
        transformedMeasurement.setInternalHumidity(new TransformedValue(){{
            setValue(0.2);
            setCalibratedValue(0.4);
        }});
        transformedMeasurement.setBattery(new TransformedValue(){{
            setValue(0.2);
            setCalibratedValue(0.4);
        }});
        transformedMeasurement.setSpeed(new TransformedValue(){{
            setValue(0.2);
            setCalibratedValue(0.4);
        }});
        transformedMeasurement.setSatellites(new TransformedValue(){{
            setValue(0.2);
            setCalibratedValue(0.4);
        }});
        transformedMeasurement.setHdop(new TransformedValue(){{
            setValue(0.2);
            setCalibratedValue(0.4);
        }});
        transformedMeasurement.setPm10(new TransformedValue(){{
            setValue(0.2);
            setCalibratedValue(0.4);
        }});
        transformedMeasurement.setPm2_5(new TransformedValue(){{
            setValue(0.2);
            setCalibratedValue(0.4);
        }});
        transformedMeasurement.setS2_pm2_5(new TransformedValue(){{
            setValue(0.2);
            setCalibratedValue(0.4);
        }});
        transformedMeasurement.setS2_pm10(new TransformedValue(){{
            setValue(0.2);
            setCalibratedValue(0.4);
        }});
        transformedMeasurement.setNo2(new TransformedValue(){{
            setValue(0.2);
            setCalibratedValue(0.4);
        }});
        transformedMeasurement.setPm1(new TransformedValue(){{
            setValue(0.2);
            setCalibratedValue(0.4);
        }});

        transformedMeasurementArrayList.add(transformedMeasurement);


        TransformedMeasurement transformedMeasurementNull = new TransformedMeasurement();
        transformedMeasurementNull.setInternalHumidity(new TransformedValue(){{
            setValue(0.2);
            setCalibratedValue(0.4);
        }});
        transformedMeasurementNull.setPm1(new TransformedValue(){{
            setValue(0.2);
            setCalibratedValue(0.4);
        }});

        transformedMeasurementArrayList.add(transformedMeasurementNull);

        return transformedMeasurementArrayList;
    }
    
    public static List<RawKccaMeasurement> composeKccaInputData(){
        List<RawKccaMeasurement> rawMeasurementsArrayList = new ArrayList<>();
        RawKccaMeasurement rawMeasurements = new RawKccaMeasurement();

        KccaXticValue kccaXticValue = new KccaXticValue();
        kccaXticValue.setRaw(0.2);
        kccaXticValue.setValue(0.1);
        kccaXticValue.setWeight(2);

        KccaXtics xtics = new KccaXtics();

        xtics.setPm1ConcMass(kccaXticValue);
        xtics.setPm2_5ConcMass(kccaXticValue);
        xtics.setNo2Conc(kccaXticValue);
        xtics.setTemperature(kccaXticValue);

        xtics.setRelHumid(kccaXticValue);
        xtics.setPm10ConcNum(kccaXticValue);
        xtics.setPm10ConcMass(kccaXticValue);
        xtics.setPm2_5ConcNum(kccaXticValue);
        xtics.setPm1ConcNum(kccaXticValue);

        KccaLocation location = new KccaLocation();
        location.setType("Point");
        List<Double>  list = new ArrayList<>();
        list.add(0.3);
        list.add(0.9);
        location.setCoordinates(list);

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
        rawMeasurements.setChannelId(-1);
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

    public static String composeAirQoInputString(){
        return "\"{\\\"time\\\":\\\"2019-06-20T13:02:01Z\\\",\\\"pm25\\\":\\\"5.04\\\",\\\"channelID\\\":295702," +
                "\\\"device\\\":\\\"6A\\\",\\\"pm10\\\":\\\"6.01\\\",\\\"s2Pm25\\\":\\\"7.46\\\",\\\"s2Pm10\\\":" +
                "\\\"1.39\\\",\\\"latitude\\\":\\\"0.283670\\\",\\\"longitude\\\":\\\"32.600399\\\",\\\"battery\\\":" +
                "\\\"4.19\\\",\\\"altitude\\\":\\\"null\\\",\\\"speed\\\":\\\"null\\\",\\\"satellites\\\":\\\"null\\\"," +
                "\\\"internalTemperature\\\":\\\"null\\\",\\\"internalHumidity\\\":\\\"null\\\",\\\"hdop\\\":" +
                "\\\"null\\\",\\\"externalTemperature\\\":\\\"null\\\",\\\"externalHumidity\\\":\\\"null\\\"," +
                "\\\"externalPressure\\\":\\\"null\\\",\\\"externalAltitude\\\":\\\"null\\\"}\"";
    }
}
