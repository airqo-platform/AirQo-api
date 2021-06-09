package net.airqo;

import com.google.gson.Gson;

import net.airqo.models.RawAirQoMeasurement;
import net.airqo.models.RawKccaMeasurement;
import net.airqo.models.TransformedMeasurement;

import org.apache.kafka.streams.*;
import org.junit.Before;
import org.junit.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

import static org.hamcrest.CoreMatchers.equalTo;
import static org.junit.Assert.*;
import static org.junit.Assert.assertEquals;

public class DeviceMeasurementsTest {

    private static final Logger logger = LoggerFactory.getLogger(DeviceMeasurementsTest.class);

    private TopologyTestDriver testDriver;
    private TestInputTopic<String, String> inputTopic;
    private TestOutputTopic<String, List<TransformedMeasurement>> outputTopic;
    List<RawAirQoMeasurement> airqoMeasurementsArrayList = new ArrayList<>();
    List<RawKccaMeasurement> kccaMeasurementsArrayList = new ArrayList<>();

//    @After
    public void tearDown() {
        testDriver.close();
    }

    @Before
    public void setup() {

//        final Properties props = DeviceMeasurements.getStreamsConfig("test.application.properties");
//
//        final StreamsBuilder builder = new StreamsBuilder();
//        DeviceMeasurements.createMeasurementsStream(builder);
//
//        testDriver = new TopologyTestDriver(builder.build(), props);
//
//        inputTopic = testDriver.createInputTopic(DeviceMeasurements.INPUT_TOPIC,
//                new StringSerializer(), new StringSerializer());
//
//        outputTopic = testDriver.createOutputTopic(DeviceMeasurements.OUTPUT_TOPIC,
//                new StringDeserializer(), new ArrayListSerde(CustomSerdes.TransformedMeasurements()).deserializer());

        airqoMeasurementsArrayList = composeAirQoInputData();
        kccaMeasurementsArrayList = composeKccaInputData();
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
    public void testTransformAirQoMeasurements(){

        String measurementsString = new Gson().toJson(airqoMeasurementsArrayList);

        RawAirQoMeasurement rawMeasurements = airqoMeasurementsArrayList.get(0);

        List<TransformedMeasurement> transformedMeasurements = Utils.transformAirQoMeasurements(measurementsString);

        assertEquals(transformedMeasurements.get(0).getTime(), rawMeasurements.getTime());
        assertEquals(transformedMeasurements.get(0).getFrequency().trim().toLowerCase(), "raw");
        assertEquals(transformedMeasurements.get(0).getDevice(), rawMeasurements.getDevice());
        assertEquals(transformedMeasurements.get(0).getTenant().trim().toLowerCase(), "airqo");
        assertEquals(transformedMeasurements.get(0).getChannelID(), Integer.parseInt(rawMeasurements.getChannelId()));

        assertEquals(transformedMeasurements.get(0).getInternalHumidity().get("value"), Utils.stringToDouble(rawMeasurements.getInternalHumidity()));
        assertEquals(transformedMeasurements.get(0).getInternalTemperature().get("value"), Utils.stringToDouble(rawMeasurements.getInternalTemperature()));

        assertEquals(transformedMeasurements.get(0).getPm2_5().get("value"), Utils.stringToDouble(rawMeasurements.getPm25()));
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
    public void testTransformKccaMeasurements(){

        String measurementsString = new Gson().toJson(kccaMeasurementsArrayList);
        RawKccaMeasurement rawMeasurements = kccaMeasurementsArrayList.get(0);

        List<TransformedMeasurement> transformedMeasurements = Utils.transformKccaMeasurements(measurementsString);

        assertEquals(transformedMeasurements.get(0).getTime(), rawMeasurements.getTime());
        assertEquals(transformedMeasurements.get(0).getFrequency().trim().toLowerCase(), "hourly");
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

//        assertEquals(transformedMeasurements.get(0).getLocation().get("latitude").get("value"), Utils.stringToDouble(Double.valueOf(rawMeasurements.getLocation().get("c"))));
//        assertEquals(transformedMeasurements.get(0).getLocation().get("longitude").get("value"), Utils.stringToDouble(rawMeasurements.getLocation().get("coordinates")[1]));


    }

//    @Test
    public void testEmptiness() {

        List<RawKccaMeasurement> rawMeasurements = composeKccaInputData();
        Gson gson = new Gson();
        String string = gson.toJson(rawMeasurements);

        inputTopic.pipeInput("id", string);

        List<TransformedMeasurement> transformedMeasurements = outputTopic.readValue();

        assertFalse(transformedMeasurements.isEmpty());
    }

//    @Test
    public void testValues() {

        List<RawKccaMeasurement> rawMeasurements = composeKccaInputData();
        inputTopic.pipeInput("id", rawMeasurements.toString());
        List<TransformedMeasurement> transformedMeasurements = outputTopic.readValue();

        assertThat(transformedMeasurements.get(0).getDevice(), equalTo(rawMeasurements.get(0).getDeviceCode()));
        assertThat(transformedMeasurements.get(0).getTime(), equalTo(rawMeasurements.get(0).getTime()));
        assertThat(transformedMeasurements.get(0).getFrequency(), equalTo("daily"));

        assertThat(transformedMeasurements.get(0).getInternalHumidity(), equalTo(new HashMap<String, Double>(){{
            put("value", rawMeasurements.get(0).getCharacteristics().get("relHumid").get("raw"));
            put("calibratedValue", rawMeasurements.get(0).getCharacteristics().get("relHumid").get("value"));
        }}));

        assertThat(transformedMeasurements.get(0).getInternalTemperature(), equalTo(new HashMap<String, Double>(){{
            put("value", rawMeasurements.get(0).getCharacteristics().get("temperature").get("raw"));
            put("calibratedValue", rawMeasurements.get(0).getCharacteristics().get("temperature").get("value"));
        }}));

        assertThat(transformedMeasurements.get(0).getNo2(), equalTo(new HashMap<String, Double>(){{
            put("value", rawMeasurements.get(0).getCharacteristics().get("no2Conc").get("raw"));
            put("calibratedValue", rawMeasurements.get(0).getCharacteristics().get("no2Conc").get("value"));
        }}));

        assertThat(transformedMeasurements.get(0).getPm10(), equalTo(new HashMap<String, Double>(){{
            put("value", rawMeasurements.get(0).getCharacteristics().get("pm10ConcMass").get("raw"));
            put("calibratedValue", rawMeasurements.get(0).getCharacteristics().get("pm10ConcMass").get("value"));
        }}));

        assertThat(transformedMeasurements.get(0).getPm1(), equalTo(new HashMap<String, Double>(){{
            put("value", rawMeasurements.get(0).getCharacteristics().get("pm1ConcMass").get("raw"));
            put("calibratedValue", rawMeasurements.get(0).getCharacteristics().get("pm1ConcMass").get("value"));
        }}));

        assertThat(transformedMeasurements.get(0).getPm2_5(), equalTo(new HashMap<String, Double>(){{
            put("value", rawMeasurements.get(0).getCharacteristics().get("pm2_5ConcMass").get("raw"));
            put("calibratedValue", rawMeasurements.get(0).getCharacteristics().get("pm2_5ConcMass").get("value"));
        }}));

        assertThat(transformedMeasurements.get(0).getLocation(), equalTo(new HashMap<String, Object>(){{
            put("latitude", new HashMap<String, Double>(){{
                put("value", 0.0);
            }});

            put("longitude", new HashMap<String, Double>(){{
                put("value", 0.0);
            }});
        }}));

    }


    private List<RawKccaMeasurement> composeKccaInputData(){
        List<RawKccaMeasurement> rawMeasurementsArrayList = new ArrayList<>();
        RawKccaMeasurement rawMeasurements = new RawKccaMeasurement();

//        JsonArray jsonArray = new JsonArray();
//        jsonArray.add(0.1);
//        jsonArray.add(0.2);

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

        rawMeasurements.set_id("id");
        rawMeasurements.setDevice("device");
        rawMeasurements.setLocation(location);
        rawMeasurements.setDeviceCode("deviceCode");
        rawMeasurements.setTime("2020-01-01T00:00:00Z");
        rawMeasurements.setCharacteristics(xtics);

        rawMeasurementsArrayList.add(rawMeasurements);

        return rawMeasurementsArrayList;
    }

    private List<RawAirQoMeasurement> composeAirQoInputData(){
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
        rawMeasurements.setInternalHumidity("91.27");
        rawMeasurements.setInternalTemperature("30.40");

        rawMeasurementsArrayList.add(rawMeasurements);

        return rawMeasurementsArrayList;
    }

}
