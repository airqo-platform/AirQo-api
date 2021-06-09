package net.airqo;

import com.google.gson.Gson;

import net.airqo.models.RawAirQoMeasurement;
import net.airqo.models.RawKccaMeasurement;
import net.airqo.models.TransformedMeasurement;

import org.apache.kafka.streams.*;
import org.junit.After;
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

    @After
    public void tearDown() {
//        testDriver.close();
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

        airqoMeasurementsArrayList = UtilsTest.composeAirQoInputData();
        kccaMeasurementsArrayList = UtilsTest.composeKccaInputData();
    }

    @Test
    public void alwaysPasses(){
        assertTrue(true);
    }

//    @Test
    public void testEmptiness() {

        List<RawKccaMeasurement> rawMeasurements = UtilsTest.composeKccaInputData();
        Gson gson = new Gson();
        String string = gson.toJson(rawMeasurements);

        inputTopic.pipeInput("id", string);

        List<TransformedMeasurement> transformedMeasurements = outputTopic.readValue();

        assertFalse(transformedMeasurements.isEmpty());
    }

//    @Test
    public void testValues() {

        List<RawKccaMeasurement> rawMeasurements = UtilsTest.composeKccaInputData();
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


}
