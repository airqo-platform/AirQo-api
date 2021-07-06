package net.airqo;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.util.JSONPObject;
import io.confluent.kafka.serializers.AbstractKafkaSchemaSerDeConfig;
import io.confluent.kafka.serializers.KafkaAvroDeserializer;
import io.confluent.kafka.serializers.KafkaAvroDeserializerConfig;
import net.airqo.models.Measurement;
import net.airqo.models.TransformedDeviceMeasurements;
import org.apache.avro.io.EncoderFactory;
import org.apache.avro.io.JsonEncoder;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

public class ApiProducer {


    private static final Logger logger = LoggerFactory.getLogger(ApiProducer.class);

    public static void main(String[] args) {
        Properties props = buildConfig();

        KafkaConsumer<Object, TransformedDeviceMeasurements> consumer = new KafkaConsumer<>(props);

        try (consumer) {
            consumer.subscribe(Collections.singletonList(props.getProperty("topic")));
            while (true) {
                ConsumerRecords<Object, TransformedDeviceMeasurements> records = consumer.poll(Duration.ofMillis(100));
                for (ConsumerRecord<Object, TransformedDeviceMeasurements> record : records){

                    try {
                        TransformedDeviceMeasurements transformedDeviceMeasurements = record.value();

                        List<Measurement> measurements = transformedDeviceMeasurements.getMeasurements();

                        Map<String, List<Measurement>> listMap = measurements.stream().collect(Collectors.groupingBy(m -> m.getDevice().toString()));

                        listMap.forEach((deviceName, deviceMeasurements) -> {
                            String tenant = deviceMeasurements.get(0).getTenant().toString();

                            logger.info(deviceName);
                            logger.info(tenant);
                            logger.info("{}", deviceMeasurements.get(0));

                            props.put("tenant", tenant);
                            props.put("device", deviceName);

                           sendToApi(deviceMeasurements, Action.ADD_EVENTS, props);

                        });
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            }
        }
    }

    private static Properties buildConfig(){

        List<String> keys = new ArrayList<>(){{
            add(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG);
            add(AbstractKafkaSchemaSerDeConfig.SCHEMA_REGISTRY_URL_CONFIG);
            add("topic");
        }};

        Properties props = new Properties();

        try (InputStream input = ApiProducer.class.getClassLoader().getResourceAsStream("application.properties")) {
            props.load(input);
        }
        catch (Exception ex){
            logger.error("Error loading properties file `application.properties` : {}", ex.toString());
        }

        Set<String> systemKeys = System.getenv().keySet();

        keys.forEach(k -> {
            String envKey = k.trim().toUpperCase();
            if(systemKeys.contains(envKey)){
                String propKey = k.trim().toLowerCase();
                props.setProperty(propKey, System.getenv(envKey));
            }
        });

        props.putIfAbsent(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, "false");
        props.putIfAbsent(ConsumerConfig.AUTO_COMMIT_INTERVAL_MS_CONFIG, "1000");
        props.setProperty(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.setProperty(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, KafkaAvroDeserializer.class.getName());
        props.setProperty(KafkaAvroDeserializerConfig.SPECIFIC_AVRO_READER_CONFIG, "true");

        return props;
    }

    abstract static class IgnoreSchemaProperty
    {
        // You have to use the correct package for JsonIgnore,
        // fasterxml or codehaus
        @JsonIgnore
        abstract void getSchema();
    }

    private static void sendToApi(Object data, Action action, Properties props){

        try {

            String urlStr = buildUrl(action, props);

            ObjectMapper objectMapper = new ObjectMapper();
            String body = objectMapper.writeValueAsString(data);

            HttpClient httpClient = HttpClient.newBuilder().build();

            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .timeout(Duration.ofMinutes(5))
                    .uri(URI.create(urlStr))
                    .setHeader("Accept", "application/json")
                    .setHeader("Content-Type", "application/json")
                    .build();

            HttpResponse<String> httpResponse = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());

            if(httpResponse.statusCode() == 200){
                logger.info("Request successful => {}",  httpResponse.body());
            }
            else {
                logger.error("Request unsuccessful => {}", httpResponse.body());
            }


        } catch (Exception e) {
            e.printStackTrace();
        }

    }

    private static String buildUrl(Action action, Properties props){

        StringBuilder url = new StringBuilder();
        url.append(props.getProperty("baseUrl"));

        switch (action){
            case ADD_EVENTS:
                url.append("devices/events?");
                Map<String, Object> params = new HashMap<>(){{
                    put("tenant", props.getProperty("tenant"));
                    put("device", props.getProperty("device"));
                }};
                params.forEach((s, o) -> url.append(String.format("%s=%s,", s, o)));
        }

        if(url.lastIndexOf(",") == url.length() - 1)
            url.deleteCharAt(url.lastIndexOf(","));

        return url.toString();
    }
}
