package net.airqo;

import com.google.gson.reflect.TypeToken;
import net.airqo.models.RawMeasurements;
import net.airqo.models.TransformedMeasurements;
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
import java.lang.reflect.Type;
import java.util.*;
import java.util.concurrent.CountDownLatch;

import com.google.gson.Gson;

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
            System.exit(1);
        }

        props.putIfAbsent(StreamsConfig.CACHE_MAX_BYTES_BUFFERING_CONFIG, 0);
        props.putIfAbsent(StreamsConfig.DEFAULT_KEY_SERDE_CLASS_CONFIG, Serdes.String().getClass().getName());
        props.putIfAbsent(StreamsConfig.DEFAULT_VALUE_SERDE_CLASS_CONFIG, CustomSerdes.RawMeasurementsSerde.class);
        props.putIfAbsent(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");

        return props;

    }

    public static List<TransformedMeasurements> transformMeasurements(String rawMeasurements) {

        if(rawMeasurements.startsWith("\""))
            rawMeasurements = rawMeasurements.replaceFirst("\"", "");

        if(rawMeasurements.endsWith("\""))
            rawMeasurements = rawMeasurements.substring(0, rawMeasurements.length() - 1);

        rawMeasurements = rawMeasurements.replace("\\\"", "\"");
        Gson gson = new Gson();

        Type listType = new TypeToken<List<RawMeasurements>>() {}.getType();
        List<RawMeasurements> deviceMeasurements = gson.fromJson(rawMeasurements, listType);

        List<TransformedMeasurements> transformedMeasurements = new ArrayList<>();

        deviceMeasurements.forEach(rawMeasurement -> {

            TransformedMeasurements transformedMeasurement = new TransformedMeasurements();

            transformedMeasurement.setDevice(rawMeasurement.getDeviceCode());
            transformedMeasurement.setFrequency("daily");
            transformedMeasurement.setTenant("kcca");
            transformedMeasurement.setTime(rawMeasurement.getTime());

            ArrayList<Double> coordinates  = (ArrayList<Double>) rawMeasurement.getLocation().get("coordinates");
            transformedMeasurement.setLocation(new HashMap<String, HashMap<String, Double>>(){{
                put("latitude", new HashMap<String, Double>(){{
                    put("value", coordinates.get(0));
                }});
                put("longitude", new HashMap<String, Double>(){{
                    put("value", coordinates.get(1));
                }});
            }});

            for (String key: rawMeasurement.getCharacteristics().keySet()) {

                double rawValue = rawMeasurement.getCharacteristics().get(key).get("raw");
                double calibrateValue;

                if(rawMeasurement.getCharacteristics().get(key).containsKey("calibratedValue"))
                    calibrateValue = rawMeasurement.getCharacteristics().get(key).get("calibratedValue");
                else
                    calibrateValue = rawMeasurement.getCharacteristics().get(key).get("value");

                HashMap<String, Double> values = new HashMap<String, Double>(){{
                    put("value", rawValue);
                    put("calibratedValue", calibrateValue);

                }};

                switch (key){
                    case "temperature":
                        transformedMeasurement.setInternalTemperature(values);
                        break;

                    case "relHumid":
                        transformedMeasurement.setInternalHumidity(values);
                        break;

                    case "pm10ConcMass":
                        transformedMeasurement.setPm10(values);
                        break;

                    case "pm2_5ConcMass":
                        transformedMeasurement.setPm2_5(values);
                        break;

                    case "no2Conc":
                        transformedMeasurement.setNo2(values);
                        break;

                    case "pm1ConcMass":
                        transformedMeasurement.setPm1(values);
                        break;

                    default:
                        break;

                }
            }

            transformedMeasurements.add(transformedMeasurement);

        });

        return transformedMeasurements;
    }

    static void createMeasurementsStream(final StreamsBuilder builder) {

        final KStream<String, String> source = builder
                .stream(INPUT_TOPIC, Consumed.with(Serdes.String(), Serdes.String()));

        final KStream<String, List<TransformedMeasurements>> transformedList = source
                .map((key, value) -> new KeyValue<>("", transformMeasurements(value)));

        transformedList.to(OUTPUT_TOPIC);
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


//    public static TransformedMeasurements transformMeasurements(RawMeasurements rawMeasurements) {
//
//        TransformedMeasurements transformedMeasurements = new TransformedMeasurements();
//
//        transformedMeasurements.setDevice(rawMeasurements.getDeviceCode());
//        transformedMeasurements.setFrequency("daily");
//        transformedMeasurements.setLocation(rawMeasurements.getLocation());
//        transformedMeasurements.setTime(rawMeasurements.getTime());
//
//        ArrayList<HashMap<String, HashMap<String, Double>>> measurements = new ArrayList<>();
//
//       for(HashMap<String, HashMap<String, Double>> components : rawMeasurements.getMeasurements()){
//
//           Set<String> componentsKeys = components.keySet();
//
//           HashMap<String, HashMap<String, Double>> hashMap = new HashMap<>();
//
//           for (String key: componentsKeys) {
//
//               switch (key){
//                   case "temperature":
//                       hashMap.put("internalTemperature", components.get(key));
//                       break;
//
//                   case "relHumid":
//                       hashMap.put("internalHumidity", components.get(key));
//                       break;
//
//                   case "pm10ConcMass":
//                       hashMap.put("pm10", components.get(key));
//                       break;
//
//                   case "pm2_5ConcMass":
//                       hashMap.put("pm2_5", components.get(key));
//                       break;
//
//                   case "no2Conc":
//                       hashMap.put("no2", components.get(key));
//                       break;
//
//                   case "pm1ConcMass":
//                       hashMap.put("pm1", components.get(key));
//                       break;
//
//                   default:
//                       hashMap = null;
//                       break;
//
//               }
//
//               if(hashMap != null)
//                   measurements.add(hashMap);
//
//           }
//
//       }
//
//       transformedMeasurements.setMeasurements(measurements);
//
//       return transformedMeasurements;
//
//
//    }
//
//    static void createMeasurementsStream(final StreamsBuilder builder) {
//
//        final KStream<String, RawMeasurements> source = builder
//                .stream(INPUT_TOPIC, Consumed.with(Serdes.String(), CustomSerdes.RawMeasurements()));
//
//        final KStream<String, TransformedMeasurements> transformed = source
//                .map((key, rawMeasurements) -> new KeyValue<>(rawMeasurements.get_id(), transformMeasurements(rawMeasurements)));
//
//        transformed.to(OUTPUT_TOPIC, Produced.with(Serdes.String(), CustomSerdes.TransformedMeasurements()));
//    }
