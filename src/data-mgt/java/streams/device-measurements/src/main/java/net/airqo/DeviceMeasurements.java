package net.airqo;

import net.airqo.models.TransformedMeasurement;
import net.airqo.serdes.CustomSerdes;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.streams.KafkaStreams;
import org.apache.kafka.streams.KeyValue;
import org.apache.kafka.streams.StreamsBuilder;
import org.apache.kafka.streams.StreamsConfig;
import org.apache.kafka.streams.kstream.Consumed;
import org.apache.kafka.streams.kstream.KStream;

import java.io.IOException;
import java.io.InputStream;
import java.util.*;
import java.util.concurrent.CountDownLatch;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class DeviceMeasurements {

    public static String INPUT_TOPIC;
    public static String OUTPUT_TOPIC;
    private static String TENANT;

    private static final Logger logger = LoggerFactory.getLogger(DeviceMeasurements.class);

    static Properties getStreamsConfig(String propertiesFile) {

        final Properties props = Utils.loadPropertiesFile(propertiesFile);

        try {

            if(!props.containsKey("bootstrap.servers") ||
                    !props.containsKey("input.topic") ||
                    !props.containsKey("tenant") ||
                    !props.containsKey("output.topic") ||
                    !props.containsKey("application.id"))
                throw new IOException("Some properties are missing");

            INPUT_TOPIC = props.getProperty("input.topic");
            OUTPUT_TOPIC = props.getProperty("output.topic");
            TENANT = props.getProperty("tenant");

        }
        catch (IOException ex){
            System.err.println(ex.getMessage());
            System.exit(1);
        }

        props.putIfAbsent(StreamsConfig.CACHE_MAX_BYTES_BUFFERING_CONFIG, 0);
        props.putIfAbsent(StreamsConfig.DEFAULT_KEY_SERDE_CLASS_CONFIG, Serdes.String().getClass().getName());
        props.putIfAbsent(StreamsConfig.DEFAULT_VALUE_SERDE_CLASS_CONFIG, CustomSerdes.RawMeasurementsSerde.class);
        props.putIfAbsent(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");

        return props;

    }

    static void createMeasurementsStream(final StreamsBuilder builder) {

        final KStream<String, String> source = builder
                .stream(INPUT_TOPIC, Consumed.with(Serdes.String(), Serdes.String()));

        final KStream<String, List<TransformedMeasurement>> transformedList = source
                .map((key, value) -> new KeyValue<>("", Utils.transformMeasurements(value, TENANT)));

        transformedList.to(OUTPUT_TOPIC);
    }

    public static void main(final String[] args) {

        final Properties props = getStreamsConfig("application.properties");

        logger.info("Started Connector");
        logger.info(new Date( System.currentTimeMillis()).toString());

        final StreamsBuilder builder = new StreamsBuilder();
        createMeasurementsStream(builder);

        final KafkaStreams streams = new KafkaStreams(builder.build(), props);
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