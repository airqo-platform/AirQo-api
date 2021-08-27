package airqo;

//import org.apache.kafka.streams.TestInputTopic;
//import org.apache.kafka.streams.TestOutputTopic;
//import org.apache.kafka.streams.TopologyTestDriver;
import org.junit.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

        import static org.junit.Assert.fail;

public class DeviceMeasurementsTest {

    private static final Logger logger = LoggerFactory.getLogger(DeviceMeasurementsTest.class);

    private static final String SCHEMA_REGISTRY_SCOPE = DeviceMeasurementsTest.class.getName();


    @Test
    public void testDeviceMeasurements() throws Exception {

//        InputStream inputStream = DeviceMeasurementsTest.class.getResourceAsStream("/transformed-device-measurements.avsc");
//
//        if (inputStream == null)
//            fail("Missing schema avsc class");
//
//        final Schema schema = new Schema.Parser().parse(inputStream);
//
//        final SchemaRegistryClient schemaRegistryClient = MockSchemaRegistry.getClientForScope(SCHEMA_REGISTRY_SCOPE);
//
//        schemaRegistryClient.register("transformed-device-measurements-value", schema);
//
//        final Properties streamsConfiguration = DeviceMeasurements.getStreamsConfig("test.application.properties");
//        final StreamsBuilder builder = new StreamsBuilder();
//        DeviceMeasurements.createMeasurementsStream(builder, streamsConfiguration);
//
//        try (final TopologyTestDriver topologyTestDriver = new TopologyTestDriver(builder.build(), streamsConfiguration)){
//
//            String INPUT_TOPIC = streamsConfiguration.getProperty("input.topic");
//            TestInputTopic<String, String> inputTopic = topologyTestDriver
//                    .createInputTopic(INPUT_TOPIC,
//                            new StringSerializer(),
//                            new StringSerializer());
//
//            String OUTPUT_TOPIC = streamsConfiguration.getProperty("output.topic");
//            TestOutputTopic<String, Object> outputTopic = topologyTestDriver
//                    .createOutputTopic(OUTPUT_TOPIC,
//                            new StringDeserializer(),
//                            new KafkaAvroDeserializer(schemaRegistryClient));
//
//            List<RawKccaMeasurement> rawMeasurements = UtilsTest.composeKccaInputData();
//
//            ObjectMapper objectMapper = new ObjectMapper();
//            String string = objectMapper.writeValueAsString(rawMeasurements);
//            inputTopic.pipeInput("id", string);
//
//            logger.info("{}", outputTopic.readValue());
////            assertThat(outputTopic.readValue(), equalTo(null));
//        }
//        finally {
//            MockSchemaRegistry.dropScope(SCHEMA_REGISTRY_SCOPE);
//        }
    }

}
