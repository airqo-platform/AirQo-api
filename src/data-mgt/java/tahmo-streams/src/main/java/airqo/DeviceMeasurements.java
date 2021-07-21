package airqo;

import airqo.models.Device;
import airqo.models.TransformedDeviceMeasurements;
import io.confluent.kafka.serializers.AbstractKafkaSchemaSerDeConfig;
import io.confluent.kafka.streams.serdes.avro.SpecificAvroSerde;
import org.apache.kafka.common.serialization.Serde;
import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.streams.*;
import org.apache.kafka.streams.kstream.Consumed;
import org.apache.kafka.streams.kstream.KStream;
import org.apache.kafka.streams.kstream.Produced;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.CountDownLatch;

public class DeviceMeasurements {
    private static final Logger logger = LoggerFactory.getLogger(DeviceMeasurements.class);

    static Properties getStreamsConfig(String propertiesFile) {

        List<String> propKeys = new ArrayList<>();
        propKeys.add("bootstrap.servers");
        propKeys.add("input.topic");
        propKeys.add("tenant");
        propKeys.add("output.topic");
        propKeys.add("schema.registry.url");
        propKeys.add("application.id");

        final Properties properties = Utils.loadPropertiesFile(propertiesFile);
        final Properties envProperties = Utils.loadEnvProperties(propKeys);

        envProperties.forEach(properties::replace);

        try {

            if(!properties.containsKey("bootstrap.servers") ||
                    !properties.containsKey("input.topic") ||
                    !properties.containsKey("tenant") ||
                    !properties.containsKey("output.topic") ||
                    !properties.containsKey(AbstractKafkaSchemaSerDeConfig.SCHEMA_REGISTRY_URL_CONFIG) ||
                    !properties.containsKey("application.id"))
                throw new IOException("Some properties are missing");
        }
        catch (IOException ex){
            System.err.println(ex.getMessage());
            System.exit(1);
        }

        properties.putIfAbsent(StreamsConfig.DEFAULT_KEY_SERDE_CLASS_CONFIG, Serdes.String().getClass().getName());
        properties.putIfAbsent(StreamsConfig.DEFAULT_VALUE_SERDE_CLASS_CONFIG, SpecificAvroSerde.class);

        return properties;

    }

    static void createMeasurementsStream(final StreamsBuilder builder, Properties props) {

        final Map<String, String> serdeConfig = Collections.singletonMap(
                AbstractKafkaSchemaSerDeConfig.SCHEMA_REGISTRY_URL_CONFIG, props.getProperty("schema.registry.url"));

        final Serde<TransformedDeviceMeasurements> measurementsSerde = new SpecificAvroSerde<>();
        measurementsSerde.configure(serdeConfig, false); // `false` for record values

        final KStream<String, TransformedDeviceMeasurements> source = builder
                .stream(props.getProperty("input.topic"), Consumed.with(Serdes.String(), measurementsSerde));


        final KStream<String, TransformedDeviceMeasurements> transformedList = source
                .map((key, value) -> {

                    return new KeyValue<>(key, Utils.addHumidityAndTemp(value, props));
                });

        transformedList.to(props.getProperty("output.topic"), Produced.valueSerde(measurementsSerde) );
    }

    public static void main(final String[] args) {

        final Properties streamsConfiguration = getStreamsConfig("application.properties");

        logger.info("Started Connector");
        logger.info(new Date( System.currentTimeMillis()).toString());

        final StreamsBuilder builder = new StreamsBuilder();
        createMeasurementsStream(builder, streamsConfiguration);

        final KafkaStreams streams = new KafkaStreams(builder.build(), streamsConfiguration);

        final CountDownLatch latch = new CountDownLatch(1);

        // attach shutdown handler to catch control-c
        Runtime.getRuntime().addShutdownHook(new Thread("streams-device-measurements-hook") {
            @Override
            public void run() {
                streams.close();
                latch.countDown();
            }
        });

        try {
            streams.start();
            latch.await();
        } catch (final Throwable e) {
            System.exit(1);
        }
        System.exit(0);
    }
}
