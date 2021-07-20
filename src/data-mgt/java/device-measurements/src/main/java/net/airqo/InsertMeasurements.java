package net.airqo;

import com.fasterxml.jackson.databind.ObjectMapper;
import net.airqo.models.TransformedMeasurement;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URL;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;

public class InsertMeasurements implements Runnable {

    private static final Logger logger = LoggerFactory.getLogger(InsertMeasurements.class);

    List<TransformedMeasurement> transformedMeasurements;
    String baseUrl;
    String tenant;

    public InsertMeasurements(List<TransformedMeasurement> transformedMeasurements, String baseUrl, String tenant) {
        this.transformedMeasurements = transformedMeasurements;
        this.baseUrl = baseUrl;
        this.tenant = tenant;
    }

    public void run(){
        try {

            if(transformedMeasurements == null)
                throw new Exception("Invalid Measurements");

            new URL(baseUrl);

            ObjectMapper objectMapper = new ObjectMapper();
//            String requestBody = objectMapper
//                    .writerWithDefaultPrettyPrinter()
//                    .writeValueAsString(transformedMeasurements);

            String requestBody = objectMapper
                    .writeValueAsString(transformedMeasurements);

            String urlString = baseUrl + "devices/events/add?tenant=" + tenant;

            HttpClient httpClient = HttpClient.newBuilder()
                    .build();
            HttpRequest request = HttpRequest.newBuilder()
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .uri(URI.create(urlString))
                    .setHeader("Accept", "application/json")
                    .setHeader("Content-Type", "application/json")
                    .build();

            HttpResponse<String> httpResponse = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if(httpResponse.statusCode() == 200){
                logger.info("Device Registry Response Body => {}", httpResponse.body());
            }
            else{
                logger.error("Device Registry Request Url => {}", urlString);
                logger.info("Device Registry Request Body => {}", requestBody);
                logger.error("Device Registry Response Body => {}", httpResponse.body());
            }
        }
        catch (Exception e){
            e.printStackTrace();
        }
    }
}
