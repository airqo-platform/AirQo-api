package net.airqo.connectors;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.TimeZone;

public class Utils {

    private static final Logger logger = LoggerFactory.getLogger(Utils.class);

    public static String buildQueryParameters(String average){

        average = average.toLowerCase().trim();

        if (average.equals("hour")){
            // fetches for last 2 hours
            SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd'T'hh:00:00'Z'");
            simpleDateFormat.setTimeZone(TimeZone.getTimeZone("UTC"));

            String startTime =  simpleDateFormat.format(new Date(System.currentTimeMillis() - 2 * 3600 * 1000 ));

            return String.format("?startTime=%s", startTime) + "&average=hour";
        }
        else if (average.equals("day")){
            // fetches for last 2 days
            SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd'T'00:00:00'Z'");
            simpleDateFormat.setTimeZone(TimeZone.getTimeZone("UTC"));

            String startTime =  simpleDateFormat.format(new Date(System.currentTimeMillis() - 48 * 3600 * 1000 ));

            return String.format("?startTime=%s", startTime) + "&average=day";
        }

        else{
            // fetches for last 15 minutes
            SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd'T'hh:mm:00'Z'");
            simpleDateFormat.setTimeZone(TimeZone.getTimeZone("UTC"));

            String startTime =  simpleDateFormat.format(new Date(System.currentTimeMillis() - 1800 * 1000 ));

            return String.format("?startTime=%s", startTime);
        }

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

