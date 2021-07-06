package net.airqo;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.util.JSONPObject;
import io.confluent.kafka.serializers.AbstractKafkaSchemaSerDeConfig;
import io.confluent.kafka.serializers.KafkaAvroDeserializer;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

public class ApiProducer {

    private static final Logger logger = LoggerFactory.getLogger(ApiProducer.class);

    public static void main(String[] args) {
        Properties props = buildConfig();

        KafkaConsumer<String, Object> consumer = new KafkaConsumer<>(props);

        try (consumer) {
            consumer.subscribe(Collections.singletonList(props.getProperty("topic")));
            while (true) {
                ConsumerRecords<String, Object> records = consumer.poll(Duration.ofMillis(100));
                for (ConsumerRecord<String, Object> record : records){
                    logger.info("offset = {}", record.offset());
                    ObjectMapper objectMapper = new ObjectMapper();
                    JsonObject data = objectMapper.convertValue(record.value(), new TypeReference<>() {});
                    logger.info("{}", data);
                    List<Measurement> measurements = objectMapper.convertValue(data.getValue()[], new TypeReference<>() {});

                }
            }
        }
    }

    private static Properties buildConfig(){

        List<String> keys = new ArrayList<>(){{
            add(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG);
            add(AbstractKafkaSchemaSerDeConfig.SCHEMA_REGISTRY_URL_CONFIG);
            add("topic");
            add(ConsumerConfig.GROUP_ID_CONFIG);
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
        props.putIfAbsent(ConsumerConfig.GROUP_ID_CONFIG, "api-producer-group");
        props.putIfAbsent(ConsumerConfig.AUTO_COMMIT_INTERVAL_MS_CONFIG, "1000");
        props.setProperty(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, "org.apache.kafka.common.serialization.StringDeserializer");
        props.setProperty(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, KafkaAvroDeserializer.class.getName());

        return props;
    }


    private static void sendToApi(JSONPObject data, String url, Action action, Properties props){

        try {

            String urlStr = buildUrl(url, action, props);

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

//    private static Map<String, Object> getQueryParameters(Action action, Object o){
//
//        Map<String, Object> params = new HashMap<>();
//
//
//        switch (action){
//            case ADD_EVENTS:
//                params.put("tenant")
//        }
//
//        return params;
//    }

    private static String buildUrl(String baseUrl, Action action, Properties props){

        StringBuilder url = new StringBuilder();
        url.append(baseUrl);

        switch (action){
            case ADD_EVENTS:
                url.append("device/events?");
        }

//        Map<String, Object> params = getQueryParameters(action);
        Map<String, Object> params = new HashMap<>(){{
            put("tenant", props.getProperty("tenant"));
            put("device", props.getProperty("tenant"));
        }};
        params.forEach((s, o) -> url.append(String.format("%s=%s,", s, o)));

        return url.toString();
    }
}
