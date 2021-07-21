package airqo;

import airqo.models.Device;
import airqo.models.DevicesResponse;
import airqo.models.StationMeasurement;
import airqo.models.TransformedDeviceMeasurements;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.*;

public class Utils {

    private static final Logger logger = LoggerFactory.getLogger(Utils.class);

    public static Properties loadPropertiesFile(String propertiesFile){

        if(propertiesFile == null)
            propertiesFile = "application.properties";

        Properties props = new Properties();

        try (InputStream input = Utils.class.getClassLoader().getResourceAsStream(propertiesFile)) {
            props.load(input);
        }
        catch (Exception ex){
            logger.error("Error loading properties file `{}` : {}", propertiesFile, ex.toString());
        }

        return props;
    }

    public static Properties loadEnvProperties(List<String> keys){

        Properties props = new Properties();
        Set<String> systemKeys = System.getenv().keySet();

        keys.forEach(k -> {
            String envKey = k.trim().toUpperCase();
            if(systemKeys.contains(envKey)){
                String propKey = k.trim().toLowerCase();
                props.setProperty(propKey, System.getenv(envKey));
            }
        });

        return props;
    }

    public static TransformedDeviceMeasurements addHumidityAndTemp(TransformedDeviceMeasurements measurements, Properties props){

        List<Device> devices = Utils.getDevices(props.getProperty("airqo.base.url"), props.getProperty("tenant"));


        measurements.getMeasurements().stream().map(measurement -> {

            Optional<Device> device = devices.stream().findFirst().filter(
                    device1 -> device1.get_id().equals(measurement.getDeviceId().toString()));

            if (device.isPresent() && !device.get().getTahmoStation().getCode().equals("")){

                StationMeasurement stationMeasurement = getStationMeasurements(
                        props.getProperty("tahmo.base.url"), device.get().getTahmoStation().getCode());

                measurement.getInternalHumidity().setValue(0.1);
                measurement.getInternalTemperature().setValue(0.1);

            }


            return measurement;
        });
        return null;
    }

    public static List<Device> getDevices(String baseUrl, String tenant){

        logger.info("\n\n********** Fetching Devices **************\n");

        DevicesResponse devicesResponse;

        try {

            String urlString =  String.format("%sdevices?tenant=%s&active=yes", baseUrl, tenant);

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

    public static StationMeasurement getStationMeasurements(String tahmoBaseUrl, String stationCode){

        logger.info("\n\n********** Fetching Devices **************\n");

        DevicesResponse devicesResponse;

        try {

            String urlString =  String.format("%sservices/measurements/v2/stations/%s/measurements/%s", tahmoBaseUrl, stationCode, "controlled");

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
            return new StationMeasurement();
        }

        return new StationMeasurement();
    }

}
