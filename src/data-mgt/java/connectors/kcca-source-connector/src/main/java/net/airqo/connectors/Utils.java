package net.airqo.connectors;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import net.airqo.connectors.models.RawMeasurements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;

public class Utils {

    private static Logger logger = LoggerFactory.getLogger(Utils.class);

    public static String buildQueryParameters(String average, String timezone){

        return "";

    }

    public static List<RawMeasurements> getMeasurements(String urlString, String apiKey){

        logger.info("\n***************** Fetching Device Measurements *************\n");

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
            List<RawMeasurements> measurements = objectMapper.readValue(httpResponse.body(), new TypeReference<>() {});

            logger.info("Device measurements => {}", measurements);

            return measurements;

        }
        catch (Exception e){
            e.printStackTrace();
        }


        return new ArrayList<>();
    }


}

