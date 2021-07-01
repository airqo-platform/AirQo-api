package net.airqo;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.confluent.kafka.serializers.AbstractKafkaSchemaSerDeConfig;
import io.confluent.kafka.serializers.KafkaAvroSerializer;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.errors.SerializationException;
import org.apache.kafka.common.serialization.StringSerializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;

public class GetDevices {

    private static final Logger logger = LoggerFactory.getLogger(GetDevices.class);

    public static void main(String[] args) {

        Properties envVariables = loadVariables();

        Properties props = new Properties();
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, KafkaAvroSerializer.class);
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG,
                envVariables.getProperty(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG));
        props.put(AbstractKafkaSchemaSerDeConfig.SCHEMA_REGISTRY_URL_CONFIG,
                envVariables.getProperty(AbstractKafkaSchemaSerDeConfig.SCHEMA_REGISTRY_URL_CONFIG));
        KafkaProducer<Object, Object> producer = new KafkaProducer<>(props);

        List<KccaDevice> kccaDevices = getKccaDevices(envVariables);

        ProducerRecord<Object, Object> record = new ProducerRecord<>(
                envVariables.getProperty("topic"), "kcca", kccaDevices);

        try {
            producer.send(record);
        } catch(SerializationException e) {
            e.printStackTrace();
        }
        finally {
            producer.flush();
            producer.close();
        }

    }

    public static List<KccaDevice> getKccaDevices(Properties properties){

        logger.info("\n\n********** Fetching Devices **************\n");

        List<KccaDevice> kccaDevices;
        try {
            HttpClient httpClient = HttpClient.newBuilder()
                    .build();

            String urlBuilder = properties.getProperty("clarity.base.url") + "devices";

            HttpRequest request = HttpRequest.newBuilder()
                    .GET()
                    .uri(URI.create(urlBuilder))
                    .setHeader("Accept", "application/json")
                    .setHeader("x-api-key", properties.getProperty("apiKey"))
                    .build();

            HttpResponse<String> httpResponse = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            ObjectMapper objectMapper = new ObjectMapper();
            kccaDevices = objectMapper.readValue(httpResponse.body(), new TypeReference<>() {});
        }
        catch (Exception e){
            e.printStackTrace();
            return new ArrayList<>();
        }

        logger.info("\n ====> Kcca Devices : {}\n", kccaDevices.toString());
        return kccaDevices;

    }

    public static Properties loadVariables(){

       String propertiesFile = "application.properties";

        Properties props = new Properties();

        try (InputStream input = GetDevices.class.getClassLoader().getResourceAsStream(propertiesFile)) {
            props.load(input);
        }
        catch (Exception ex){
            logger.error("Error loading properties file `{}` : {}", propertiesFile, ex.toString());
        }

        System.getenv().keySet().forEach(k -> {
            String propKey = k.trim().toLowerCase();
            props.setProperty(propKey, System.getenv(propKey));
        });

        return props;
    }

}


