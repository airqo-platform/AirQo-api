package net.airqo;

import com.google.gson.reflect.TypeToken;
import net.airqo.models.RawAirQoMeasurements;
import net.airqo.models.RawKccaMeasurements;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class DeviceMeasurements {

    public static String INPUT_TOPIC;
    public static String OUTPUT_TOPIC;
    private static String TENANT;

    private static final Logger logger = LoggerFactory.getLogger(DeviceMeasurements.class);

    static Properties getStreamsConfig(String propertiesFile) {

        final Properties props = new Properties();

        try (InputStream input = DeviceMeasurements.class.getClassLoader().getResourceAsStream(propertiesFile)) {

            props.load(input);

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

        final KStream<String, List<TransformedMeasurements>> transformedList = source
                .map((key, value) -> new KeyValue<>("", transformMeasurements(value)));

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

    public static List<TransformedMeasurements> transformMeasurements(String rawMeasurements) {

        if(rawMeasurements.startsWith("\""))
            rawMeasurements = rawMeasurements.replaceFirst("\"", "");

        if(rawMeasurements.endsWith("\""))
            rawMeasurements = rawMeasurements.substring(0, rawMeasurements.length() - 1);

        rawMeasurements = rawMeasurements.replace("\\\"", "\"");

        switch (TENANT.trim().toUpperCase()){
            case "KCCA":
                return transformKccaMeasurements(rawMeasurements);
            case "AIRQO":
                return transformAirQoMeasurements(rawMeasurements);
            default:
                return new ArrayList<>();
        }
    }

    public static List<TransformedMeasurements> transformKccaMeasurements(String rawMeasurements) {

        Type listType = new TypeToken<List<RawKccaMeasurements>>() {}.getType();
        List<RawKccaMeasurements> deviceMeasurements = new Gson().fromJson(rawMeasurements, listType);

        List<TransformedMeasurements> transformedMeasurements = new ArrayList<>();

        deviceMeasurements.forEach(rawMeasurement -> {

            TransformedMeasurements transformedMeasurement = new TransformedMeasurements();

            transformedMeasurement.setDevice(rawMeasurement.getDeviceCode());
            transformedMeasurement.setFrequency("hourly");
            transformedMeasurement.setTenant("kcca");
            transformedMeasurement.setTime(rawMeasurement.getTime());

            ArrayList<Double> coordinates  = (ArrayList<Double>) rawMeasurement.getLocation().get("coordinates");
            transformedMeasurement.setLocation(new HashMap<String, HashMap<String, Object>>(){{
                put("latitude", new HashMap<String, Object>(){{
                    put("value", coordinates.get(0));
                }});
                put("longitude", new HashMap<String, Object>(){{
                    put("value", coordinates.get(1));
                }});
            }});

            for (String key: rawMeasurement.getCharacteristics().keySet()) {

                double rawValue = rawMeasurement.getCharacteristics().get(key).get("raw");
                double calibratedValue;

                if(rawMeasurement.getCharacteristics().get(key).containsKey("calibratedValue"))
                    calibratedValue = rawMeasurement.getCharacteristics().get(key).get("calibratedValue");
                else calibratedValue = rawMeasurement.getCharacteristics().get(key).getOrDefault("value", rawValue);

                HashMap<String, Object> values = new HashMap<String, Object>(){{
                    put("value", rawValue);
                    put("calibratedValue", calibratedValue);

                }};

                key = key.trim().toLowerCase();

                switch (key){
                    case "temperature":
                        transformedMeasurement.setInternalTemperature(values);
                        break;

                    case "relhumid":
                        transformedMeasurement.setInternalHumidity(values);
                        break;

                    case "pm10concmass":
                        transformedMeasurement.setPm10(values);
                        break;

                    case "pm2_5concmass":
                        transformedMeasurement.setPm2_5(values);
                        break;

                    case "no2conc":
                        transformedMeasurement.setNo2(values);
                        break;

                    case "pm1concmass":
                        transformedMeasurement.setPm1(values);
                        break;

                    default:
                        break;

                }
            }

            transformedMeasurements.add(transformedMeasurement);

        });

        logger.info(new Date( System.currentTimeMillis()).toString());
        logger.info("Records got : " + String.valueOf(transformedMeasurements.size()));

        return transformedMeasurements;
    }

    public static List<TransformedMeasurements> transformAirQoMeasurements(String rawMeasurements) {

        Type listType = new TypeToken<List<RawAirQoMeasurements>>() {}.getType();
        List<RawAirQoMeasurements> deviceMeasurements = new Gson().fromJson(rawMeasurements, listType);

        List<TransformedMeasurements> transformedMeasurements = new ArrayList<>();

        deviceMeasurements.forEach(rawMeasurement -> {

            TransformedMeasurements transformedMeasurement = new TransformedMeasurements();

            transformedMeasurement.setDevice(rawMeasurement.getDevice());
            transformedMeasurement.setFrequency("raw");
            transformedMeasurement.setTenant("airqo");
            transformedMeasurement.setChannelID(Integer.parseInt(rawMeasurement.getChannelId()));
            transformedMeasurement.setTime(rawMeasurement.getTime());

            transformedMeasurement.setLocation(new HashMap<String, HashMap<String, Object>>(){{
                put("latitude", new HashMap<String, Object>(){{
                    put("value", Utils.stringToDouble(rawMeasurement.getLatitude()));
                }});
                put("longitude", new HashMap<String, Object>(){{
                    put("value", Utils.stringToDouble(rawMeasurement.getLongitude()));
                }});
            }});

            transformedMeasurement.setInternalTemperature(new HashMap<String, Object>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getInternalTemperature()));
                put("calibratedValue", Utils.stringToDouble(rawMeasurement.getInternalTemperature()));
            }});

            transformedMeasurement.setInternalHumidity(new HashMap<String, Object>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getInternalHumidity()));
                put("calibratedValue", Utils.stringToDouble(rawMeasurement.getInternalHumidity()));
            }});

            transformedMeasurement.setPm2_5(new HashMap<String, Object>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getPm25()));
                put("calibratedValue", Utils.stringToDouble(rawMeasurement.getPm25()));

            }});

            transformedMeasurement.setPm10(new HashMap<String, Object>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getPm10()));
                put("calibratedValue", Utils.stringToDouble(rawMeasurement.getPm10()));

            }});

            transformedMeasurement.setS2_pm2_5(new HashMap<String, Object>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getS2Pm25()));
                put("calibratedValue", Utils.stringToDouble(rawMeasurement.getS2Pm25()));

            }});

            transformedMeasurement.setS2_pm10(new HashMap<String, Object>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getS2Pm10()));
                put("calibratedValue", Utils.stringToDouble(rawMeasurement.getS2Pm10()));

            }});

            transformedMeasurement.setAltitude(new HashMap<String, Object>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getAltitude()));
                put("calibratedValue", Utils.stringToDouble(rawMeasurement.getAltitude()));

            }});

            transformedMeasurement.setSpeed(new HashMap<String, Object>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getSpeed()));
                put("calibratedValue", Utils.stringToDouble(rawMeasurement.getSpeed()));

            }});

            transformedMeasurement.setBattery(new HashMap<String, Object>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getBattery()));
                put("calibratedValue", Utils.stringToDouble(rawMeasurement.getBattery()));

            }});

            transformedMeasurement.setSatellites(new HashMap<String, Object>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getSatellites()));
                put("calibratedValue", Utils.stringToDouble(rawMeasurement.getSatellites()));

            }});

            transformedMeasurement.setHdop(new HashMap<String, Object>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getHdop()));
                put("calibratedValue", Utils.stringToDouble(rawMeasurement.getHdop()));

            }});


            transformedMeasurements.add(transformedMeasurement);

        });

        logger.info(new Date( System.currentTimeMillis()).toString());
        logger.info("Records got : " + transformedMeasurements.size());

        return transformedMeasurements;
    }

}