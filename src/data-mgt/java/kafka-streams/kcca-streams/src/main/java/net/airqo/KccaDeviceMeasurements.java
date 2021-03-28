package net.airqo;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.streams.KafkaStreams;
import org.apache.kafka.streams.KeyValue;
import org.apache.kafka.streams.StreamsBuilder;
import org.apache.kafka.streams.StreamsConfig;
import org.apache.kafka.streams.kstream.Consumed;
import org.apache.kafka.streams.kstream.KStream;
import org.apache.kafka.streams.kstream.Produced;

import java.io.IOException;
import java.io.InputStream;
import java.util.*;
import java.util.concurrent.CountDownLatch;

public class KccaDeviceMeasurements {

    public static String INPUT_TOPIC;
    public static String OUTPUT_TOPIC;

    static Properties getStreamsConfig(String propertiesFile) {

        final Properties props = new Properties();

        try (InputStream input = KccaDeviceMeasurements.class.getClassLoader().getResourceAsStream(propertiesFile)) {

            props.load(input);

            if(!props.containsKey("bootstrap.servers") ||
                    !props.containsKey("input.topic") ||
                    !props.containsKey("output.topic") ||
                    !props.containsKey("application.id"))
                throw new IOException("Some properties are missing");

            INPUT_TOPIC = props.getProperty("input.topic");
            OUTPUT_TOPIC = props.getProperty("output.topic");

        }
        catch (IOException ex){
            System.err.println(ex.getMessage());
//            ex.printStackTrace();
            System.exit(1);
        }

        props.putIfAbsent(StreamsConfig.CACHE_MAX_BYTES_BUFFERING_CONFIG, 0);
        props.putIfAbsent(StreamsConfig.DEFAULT_KEY_SERDE_CLASS_CONFIG, Serdes.String().getClass().getName());
        props.putIfAbsent(StreamsConfig.DEFAULT_VALUE_SERDE_CLASS_CONFIG, CustomSerdes.RawMeasurementsSerde.class);
        props.putIfAbsent(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");

        return props;

    }

    public static TransformedMeasurements transformMeasurements(RawMeasurements rawMeasurements) {

        TransformedMeasurements transformedMeasurements = new TransformedMeasurements();

        transformedMeasurements.setDevice(rawMeasurements.getDeviceCode());
        transformedMeasurements.setFrequency("daily");
        transformedMeasurements.setLocation(rawMeasurements.getLocation());
        transformedMeasurements.setTime(rawMeasurements.getTime());

        ArrayList<HashMap<String, HashMap<String, Double>>> measurements = new ArrayList<>();

       for(HashMap<String, HashMap<String, Double>> components : rawMeasurements.getMeasurements()){

           Set<String> componentsKeys = components.keySet();

           HashMap<String, HashMap<String, Double>> hashMap = new HashMap<>();

           for (String key: componentsKeys) {

               switch (key){
                   case "temperature":
                       hashMap.put("internalTemperature", components.get(key));
                       break;

                   case "relHumid":
                       hashMap.put("internalHumidity", components.get(key));
                       break;

                   case "pm10ConcMass":
                       hashMap.put("pm10", components.get(key));
                       break;

                   case "pm2_5ConcMass":
                       hashMap.put("pm2_5", components.get(key));
                       break;

                   case "no2Conc":
                       hashMap.put("no2", components.get(key));
                       break;

                   case "pm1ConcMass":
                       hashMap.put("pm1", components.get(key));
                       break;

                   default:
                       hashMap = null;
                       break;

               }

               if(hashMap != null)
                   measurements.add(hashMap);

           }

       }

       transformedMeasurements.setMeasurements(measurements);

       return transformedMeasurements;


    }

    static void createMeasurementsStream(final StreamsBuilder builder) {

        final KStream<String, RawMeasurements> source = builder
                .stream(INPUT_TOPIC, Consumed.with(Serdes.String(), CustomSerdes.RawMeasurements()));

        final KStream<String, TransformedMeasurements> transformed = source
                .map((key, rawMeasurements) -> new KeyValue<>(rawMeasurements.getId(), transformMeasurements(rawMeasurements)));

        transformed.to(OUTPUT_TOPIC, Produced.with(Serdes.String(), CustomSerdes.ProcessedMeasurements()));
    }

    public static void main(final String[] args) {

        final Properties props = getStreamsConfig("app.properties");

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
