package net.airqo;

import com.google.gson.JsonArray;
import net.airqo.models.RawMeasurements;
import net.airqo.models.TransformedMeasurements;
import net.airqo.serdes.ArrayListSerde;
import net.airqo.serdes.CustomSerdes;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.apache.kafka.streams.*;

import java.util.*;

import org.junit.After;
import org.junit.Before;

public class KccaDeviceMeasurementsTest {

    private TopologyTestDriver testDriver;
    private TestInputTopic<String, String> inputTopic;
    private TestOutputTopic<String, List<TransformedMeasurements>> outputTopic;

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
//
//        inputTopic = testDriver.createInputTopic(KccaDeviceMeasurements.INPUT_TOPIC,
//                new StringSerializer(), CustomSerdes.RawMeasurements().serializer());
//
        outputTopic = testDriver.createOutputTopic(KccaDeviceMeasurements.OUTPUT_TOPIC,
                new StringDeserializer(), new ArrayListSerde(CustomSerdes.RawMeasurements()).deserializer());

        inputTopic = testDriver.createInputTopic(KccaDeviceMeasurements.INPUT_TOPIC,
                new StringSerializer(), new StringSerializer());
    }


//    @Test
//    public void testEmptiness() {
//
//        List<RawMeasurements> rawMeasurements = composeInputData();
//        Gson gson = new Gson();
//        String string = gson.toJson(rawMeasurements);
//
//        inputTopic.pipeInput("id", string);
//
//
//
//        List<TransformedMeasurements> transformedMeasurements = outputTopic.readValue();
//
//        assertThat(transformedMeasurements.get(0).getTime().isEmpty(), equalTo(false));
//        assertThat(transformedMeasurements.get(0).getFrequency().isEmpty(), equalTo(false));
//        assertThat(transformedMeasurements.get(0).getLocation().isEmpty(), equalTo(false));
//        assertThat(transformedMeasurements.get(0).getDevice().isEmpty(), equalTo(false));
//
//        assertThat(transformedMeasurements.get(0).getInternalHumidity().isEmpty(), equalTo(false));
//        assertThat(transformedMeasurements.get(0).getInternalTemperature().isEmpty(), equalTo(false));
//        assertThat(transformedMeasurements.get(0).getNo2().isEmpty(), equalTo(false));
//        assertThat(transformedMeasurements.get(0).getPm1().isEmpty(), equalTo(false));
//        assertThat(transformedMeasurements.get(0).getPm2_5().isEmpty(), equalTo(false));
//        assertThat(transformedMeasurements.get(0).getPm10().isEmpty(), equalTo(false));
//    }
//
//    @Test
//    public void testValues() {
//
//        List<RawMeasurements> rawMeasurements = composeInputData();
//        inputTopic.pipeInput("id", rawMeasurements.toString());
//        List<TransformedMeasurements> transformedMeasurements = outputTopic.readValue();
//
//        assertThat(transformedMeasurements.get(0).getDevice(), equalTo(rawMeasurements.get(0).getDeviceCode()));
//        assertThat(transformedMeasurements.get(0).getTime(), equalTo(rawMeasurements.get(0).getTime()));
//        assertThat(transformedMeasurements.get(0).getFrequency(), equalTo("daily"));
//
//        assertThat(transformedMeasurements.get(0).getInternalHumidity(), equalTo(new HashMap<String, Double>(){{
//            put("value", rawMeasurements.get(0).getCharacteristics().get("relHumid").get("raw"));
//            put("calibratedValue", rawMeasurements.get(0).getCharacteristics().get("relHumid").get("value"));
//        }}));
//
//        assertThat(transformedMeasurements.get(0).getInternalTemperature(), equalTo(new HashMap<String, Double>(){{
//            put("value", rawMeasurements.get(0).getCharacteristics().get("temperature").get("raw"));
//            put("calibratedValue", rawMeasurements.get(0).getCharacteristics().get("temperature").get("value"));
//        }}));
//
//        assertThat(transformedMeasurements.get(0).getNo2(), equalTo(new HashMap<String, Double>(){{
//            put("value", rawMeasurements.get(0).getCharacteristics().get("no2Conc").get("raw"));
//            put("calibratedValue", rawMeasurements.get(0).getCharacteristics().get("no2Conc").get("value"));
//        }}));
//
//        assertThat(transformedMeasurements.get(0).getPm10(), equalTo(new HashMap<String, Double>(){{
//            put("value", rawMeasurements.get(0).getCharacteristics().get("pm10ConcMass").get("raw"));
//            put("calibratedValue", rawMeasurements.get(0).getCharacteristics().get("pm10ConcMass").get("value"));
//        }}));
//
//        assertThat(transformedMeasurements.get(0).getPm1(), equalTo(new HashMap<String, Double>(){{
//            put("value", rawMeasurements.get(0).getCharacteristics().get("pm1ConcMass").get("raw"));
//            put("calibratedValue", rawMeasurements.get(0).getCharacteristics().get("pm1ConcMass").get("value"));
//        }}));
//
//        assertThat(transformedMeasurements.get(0).getPm2_5(), equalTo(new HashMap<String, Double>(){{
//            put("value", rawMeasurements.get(0).getCharacteristics().get("pm2_5ConcMass").get("raw"));
//            put("calibratedValue", rawMeasurements.get(0).getCharacteristics().get("pm2_5ConcMass").get("value"));
//        }}));
//
//        assertThat(transformedMeasurements.get(0).getLocation(), equalTo(new HashMap<String, Object>(){{
//            put("latitude", new HashMap<String, Double>(){{
//                put("value", 0.0);
//            }});
//
//            put("longitude", new HashMap<String, Double>(){{
//                put("value", 0.0);
//            }});
//        }}));
//
//    }


    private List<RawMeasurements> composeInputData(){
        List<RawMeasurements> rawMeasurementsArrayList = new ArrayList<>();
        RawMeasurements rawMeasurements = new RawMeasurements();

        JsonArray jsonArray = new JsonArray();
        jsonArray.add(0.0);
        jsonArray.add(0.0);

        HashMap<String, Object> location = new HashMap<String, Object>(){{
            put("coordinates", jsonArray);
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

}
