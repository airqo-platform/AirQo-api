package net.airqo.connectors;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import net.airqo.models.AirQoDevicesResponse;
import net.airqo.models.AirqoDevice;
import net.airqo.models.RawMeasurement;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;

public class Utils {

    static final Logger logger = LoggerFactory.getLogger(Utils.class);

    public static List<AirqoDevice> getDevices(String baseUrl){

        logger.info("\n\n********** Fetching Devices **************\n");

        AirQoDevicesResponse devicesResponse;

        try {

            String urlString = baseUrl + "devices?tenant=airqo&active=yes";

            HttpClient httpClient = HttpClient.newBuilder()
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .GET()
                    .uri(URI.create(urlString))
                    .setHeader("Accept", "application/json")
                    .build();

            HttpResponse<String> httpResponse = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            ObjectMapper objectMapper = new ObjectMapper();
            devicesResponse = objectMapper.readValue(httpResponse.body(), new TypeReference<>() {});

        }
        catch (Exception e){
            e.printStackTrace();
            return new ArrayList<>();
        }

        logger.info("\n ====> Devices : {}\n", devicesResponse.getDevices());
        return devicesResponse.getDevices();
    }

    public static RawMeasurement getMeasurements(String urlString){

        logger.info("\n\n**************** Fetching Measurements *************\n");
        logger.info("\n ====> Url : {}\n", urlString);

        try {
            HttpClient httpClient = HttpClient.newBuilder()
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .GET()
                    .uri(URI.create(urlString))
                    .setHeader("Accept", "application/json")
                    .build();

            HttpResponse<String> httpResponse = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            RawMeasurement measurements = new ObjectMapper().readerFor(RawMeasurement.class).readValue(httpResponse.body());

            logger.info("Device measurements => {}", measurements);

            return measurements;

        }
        catch (Exception e){
            e.printStackTrace();
            return null;
        }

    }

}
