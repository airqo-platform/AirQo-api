package purpleAir;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class Utils {

    private static final Logger log = LoggerFactory.getLogger(Utils.class);

    public static PurpleAirData getData(String urlString, String apiKey) {

        log.info("\n***************** Fetching Purple Air Data *************\n");

        try {
            HttpClient httpClient = HttpClient.newBuilder()
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .GET()
                    .uri(URI.create(urlString))
                    .setHeader("Accept", "application/json")
                    .setHeader("x-api-key", apiKey)
                    .build();

            HttpResponse<String> httpResponse = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            ObjectMapper objectMapper = new ObjectMapper();
            PurpleAirData purpleAirData = objectMapper.readValue(httpResponse.body(), new TypeReference<>() {
            });

            log.info("Url => {}", urlString);
            log.info("Purple Air Data => {}", purpleAirData);

            return purpleAirData;

        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }

}

