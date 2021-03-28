package net.airqo;

import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.apache.kafka.streams.*;

import java.util.*;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import static org.hamcrest.CoreMatchers.*;
import static org.junit.Assert.*;

public class KccaDeviceMeasurementsTest {

    private TopologyTestDriver testDriver;
    private TestInputTopic<String, RawMeasurements> inputTopic;
    private TestOutputTopic<String, TransformedMeasurements> outputTopic;

    @After
    public void tearDown() {
        testDriver.close();
    }

    @Before
    public void setup() {

        final Properties props = KccaDeviceMeasurements.getStreamsConfig("app.test.properties");

        final StreamsBuilder builder = new StreamsBuilder();
        KccaDeviceMeasurements.createMeasurementsStream(builder);

        testDriver = new TopologyTestDriver(builder.build(), props);

        inputTopic = testDriver.createInputTopic(KccaDeviceMeasurements.INPUT_TOPIC,
                new StringSerializer(), CustomSerdes.RawMeasurements().serializer());

        outputTopic = testDriver.createOutputTopic(KccaDeviceMeasurements.OUTPUT_TOPIC,
                new StringDeserializer(), CustomSerdes.ProcessedMeasurements().deserializer());
    }

    @Test
    public void testEmptiness() {

        RawMeasurements rawMeasurements = composeInputData();
        inputTopic.pipeInput("id", rawMeasurements);
        TransformedMeasurements transformedMeasurements = outputTopic.readValue();

        assertThat(transformedMeasurements.getTime().isEmpty(), equalTo(false));
        assertThat(transformedMeasurements.getFrequency().isEmpty(), equalTo(false));
        assertThat(transformedMeasurements.getLocation().isEmpty(), equalTo(false));
        assertThat(transformedMeasurements.getDevice().isEmpty(), equalTo(false));
        assertThat(transformedMeasurements.getMeasurements().isEmpty(), equalTo(false));
    }

    @Test
    public void testMeasurements() {

        RawMeasurements rawMeasurements = composeInputData();
        inputTopic.pipeInput("id", rawMeasurements);
        TransformedMeasurements transformedMeasurements = outputTopic.readValue();

        HashMap<String, HashMap<String, Double>> measurements = new HashMap<String, HashMap<String, Double>>() {{

            put("internalTemperature", new HashMap<String, Double>() {{
                put("value", 0.0);
                put("calibratedValue", 0.0);
            }});

            put("internalHumidity", new HashMap<String, Double>() {{
                put("value", 0.0);
                put("calibratedValue", 0.0);
            }});

            put("pm10", new HashMap<String, Double>() {{
                put("value", 0.0);
                put("calibratedValue", 0.0);
            }});

            put("pm2_5", new HashMap<String, Double>() {{
                put("value", 0.0);
                put("calibratedValue", 0.0);
            }});

            put("no2", new HashMap<String, Double>() {{
                put("value", 0.0);
                put("calibratedValue", 0.0);
            }});

            put("pm1", new HashMap<String, Double>() {{
                put("value", 0.0);
                put("calibratedValue", 0.0);
            }});

        }};

        assertThat(transformedMeasurements.getMeasurements().get(0), equalTo(measurements));

    }

    @Test
    public void testLocation() {

        RawMeasurements rawMeasurements = composeInputData();
        inputTopic.pipeInput("id", rawMeasurements);
        TransformedMeasurements transformedMeasurements = outputTopic.readValue();

        assertThat(transformedMeasurements.getLocation(), equalTo(new HashMap<String, Double>(){{
            put("latitude", 0.0);
            put("longitude", 0.0);
        }}));

//        assertThat(transformedMeasurements.getLocation().containsKey("latitude"), equalTo(true));
//        assertThat(transformedMeasurements.getLocation().containsKey("longitude"), equalTo(true));
//
//        assertThat(transformedMeasurements.getLocation().get("latitude") != null, equalTo(true));
//        assertThat(transformedMeasurements.getLocation().get("longitude") != null, equalTo(true));
//
//        assertThat(transformedMeasurements.getLocation().get("latitude") , equalTo(0.0));
//        assertThat(transformedMeasurements.getLocation().get("longitude") , equalTo(0.0));

    }


    private RawMeasurements composeInputData(){
        RawMeasurements rawMeasurements = new RawMeasurements();

        HashMap<String, Double> location = new HashMap<String, Double>(){{
            put("latitude", 0.0);
            put("longitude", 0.0);
        }};

        ArrayList<HashMap<String, HashMap<String, Double>>> measurements = new ArrayList<>();

        measurements.add(new HashMap<String, HashMap<String, Double>>() {{

            put("temperature", new HashMap<String, Double>() {{
                put("value", 0.0);
                put("calibratedValue", 0.0);
            }});

            put("pm1ConcMass", new HashMap<String, Double>() {{
                put("value", 0.0);
                put("calibratedValue", 0.0);
            }});

            put("no2Conc", new HashMap<String, Double>() {{
                put("value", 0.0);
                put("calibratedValue", 0.0);
            }});

            put("pm2_5ConcMass", new HashMap<String, Double>() {{
                put("value", 0.0);
                put("calibratedValue", 0.0);
            }});

            put("pm10ConcMass", new HashMap<String, Double>() {{
                put("value", 0.0);
                put("calibratedValue", 0.0);
            }});

            put("relHumid", new HashMap<String, Double>() {{
                put("value", 0.0);
                put("calibratedValue", 0.0);
            }});

        }});

        rawMeasurements.setId("id");
        rawMeasurements.setDevice("device");
        rawMeasurements.setLocation(location);
        rawMeasurements.setDeviceCode("deviceCode");
        rawMeasurements.setTime("2020-01-01T00:00:00Z");
        rawMeasurements.setMeasurements(measurements);

        return rawMeasurements;
    }

}
