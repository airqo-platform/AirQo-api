package airqo;

import airqo.models.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.lang3.time.DateUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.core.HttpHeaders;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.stream.Collectors;

public class Utils {

    private static final Logger logger = LoggerFactory.getLogger(Utils.class);
    public static SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd'T'hh:mm:ss'Z'");
    private static final HttpClient httpClient = HttpClient.newBuilder().build();

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

    public static TransformedDeviceMeasurements addHumidityAndTemp(TransformedDeviceMeasurements deviceMeasurements, Properties props){

        List<Site> sites = Utils.getSites(props.getProperty("airqo.base.url"), props.getProperty("tenant"));

        List<Measurement> measurements = deviceMeasurements.getMeasurements();

        List<Measurement> measurementList = measurements.stream().peek(measurement -> {

            Optional<Site> deviceSite = sites.stream().filter(
                    site -> site.get_id().trim().equalsIgnoreCase(measurement.getSiteId().toString().trim())).findFirst();

            try {
                if (deviceSite.isPresent()){

                    Site.NearestStation station = deviceSite.get().getNearestStation();
                    Date endTime = dateFormat.parse(measurement.getTime().toString());
                    Date startTime = DateUtils.addHours(endTime, -24);

                    StationResponse stationResponse = getStationMeasurements(
                            props, station.getCode(), startTime, endTime, station.getTimezone());

                    List<StationMeasurement> stationMeasurements = stationResponseToMeasurements(stationResponse);

                    Optional<StationMeasurement> stationTemp = stationMeasurements.stream().filter(stationMeasurement -> stationMeasurement.getVariable().equals(Variable.TEMPERATURE)).reduce((measurement1, measurement2) -> {
                        if (measurement1.getTime().after(measurement2.getTime()))
                            return measurement1;
                        return measurement2;
                    });

                    Optional<StationMeasurement> stationHumidity = stationMeasurements.stream().filter(stationMeasurement -> stationMeasurement.getVariable().toString().equals("rh")).reduce((measurement1, measurement2) -> {
                        if (measurement1.getTime().after(measurement2.getTime()))
                            return measurement1;
                        return measurement2;
                    });

                    measurement.getInternalHumidity().setValue(stationHumidity.orElseThrow().getValue());
                    measurement.getInternalTemperature().setValue(stationTemp.orElseThrow().getValue());
                }
            } catch (Exception e) {
                e.printStackTrace();
            }

        }).collect(Collectors.toList());

        measurementList.forEach(measurement -> {
            logger.info("Humidity : {} , Temperature : {} , Device : {}",
                    measurement.getInternalHumidity().getValue(),
                    measurement.getInternalTemperature().getValue(),
                    measurement.getDevice());
        });

        return TransformedDeviceMeasurements.newBuilder().setMeasurements(measurementList).build();
    }

    public static List<Site> getSites(String baseUrl, String tenant){

        logger.info("\n\n********** Fetching Sites **************\n");

        SitesResponse sitesResponse;

        try {

            String urlString =  String.format("%sdevices/sites?tenant=%s", baseUrl, tenant);

            HttpRequest request = HttpRequest.newBuilder()
                    .GET()
                    .uri(URI.create(urlString))
                    .setHeader("Accept", "application/json")
                    .build();

            HttpResponse<String> httpResponse = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            ObjectMapper objectMapper = new ObjectMapper();
            sitesResponse = objectMapper.readValue(httpResponse.body(), new TypeReference<>() {});
        }
        catch (Exception e){
            e.printStackTrace();
            return new ArrayList<>();
        }

//        logger.info("\n ====> Sites : {}\n", sitesResponse.getSites());
        return sitesResponse.getSites();
    }

    public static List<Device> getDevices(String baseUrl, String tenant){

        logger.info("\n\n********** Fetching Devices **************\n");

        DevicesResponse devicesResponse;

        try {

            String urlString =  String.format("%sdevices?tenant=%s&active=yes", baseUrl, tenant);

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

        StringBuilder stringBuilder = new StringBuilder();

        devicesResponse.getDevices().forEach(device -> {
            stringBuilder.append(" , ").append(device.getDevice_number());
        });

        logger.info("\n ====> Devices : {}\n", stringBuilder);
        return devicesResponse.getDevices();
    }

    public static StationResponse getStationMeasurements(Properties props, String stationCode, Date startTime, Date endTime, String stationTimeZone){

        logger.info("\n\n********** Fetching Station Data **************\n");

        StationResponse stationResponse;

        try {

            SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd'T'hh:mm:ss'Z'");
            dateFormat.setTimeZone(TimeZone.getTimeZone(stationTimeZone));

            logger.info("{}", dateFormat.format(startTime));
            logger.info("{}", dateFormat.format(endTime));

            String urlString =  String.format("%sservices/measurements/v2/stations/%s/measurements/%s?start=%s&end=%s",
                    props.getProperty("tahmo.base.url") , stationCode, "controlled", dateFormat.format(startTime), dateFormat.format(endTime));

            logger.info("Station Measurements url {}", urlString);
            HttpClient httpClient = HttpClient.newBuilder()
                    .build();

            String auth = props.getProperty("tahmo.user") + ":" + props.getProperty("tahmo.password");
            byte[] encodedAuth = Base64.getEncoder().encode(
                    auth.getBytes(StandardCharsets.ISO_8859_1));
            String authHeader = "Basic " + new String(encodedAuth);

            HttpRequest request = HttpRequest.newBuilder()
                    .GET()
                    .uri(URI.create(urlString))
                    .setHeader("Accept", "application/json")
                    .setHeader(HttpHeaders.AUTHORIZATION, authHeader)
                    .build();

            HttpResponse<String> httpResponse = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            ObjectMapper objectMapper = new ObjectMapper();

            stationResponse = objectMapper.readValue(httpResponse.body(), new TypeReference<>() {});
            return stationResponse;
        }
        catch (Exception e){
            e.printStackTrace();
            return new StationResponse();
        }

    }

    public static List<StationMeasurement> stationResponseToMeasurements(StationResponse stationResponse){

        List<StationMeasurement> measurements = new ArrayList<>();
        try {

            List<List<Object>> objects = stationResponse.getResults().get(0).getSeries().get(0).getValues();

            objects.forEach(object -> {

                String var = String.valueOf(object.get(11)).trim().toLowerCase();
                String time = String.valueOf(object.get(0)).trim();

                    if(var.equals("te") || var.equals("rh")){
                        Variable variable = Variable.fromString(var);
                        Double value = Double.valueOf(object.get(10) + "");
                        Date dateTime = null;

                        try {
                            dateTime = dateFormat.parse(time);
                        } catch (ParseException e) {
                            e.printStackTrace();
                        }

                        StationMeasurement measurement = new StationMeasurement(dateTime, value, variable);
                        measurements.add(measurement);
                    }
            });
        } catch (Exception e) {
            e.printStackTrace();
        }

        return measurements;
    }

    public static void getMeasurements(String urlString, String device, int channel){

        logger.info("\n\n**************** Fetching Measurements *************\n");
        logger.info("\n====> Url : {}\n", urlString);

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

            String humidity = measurements.getInternalHumidity().toLowerCase().trim();
            String temp = measurements.getInternalTemperature().toLowerCase().trim();

            if(isNull(humidity) || isNull(temp) ){
                logger.info(device + " : " + channel);
//                logger.info(device);
            }
        }
        catch (Exception e){
            e.printStackTrace();
        }
    }

    public static boolean isNull(String value){
        try {
            double data = Double.parseDouble(value);
            if (data < 0.0 || data > 1000 )
                return true;

        } catch (NumberFormatException e) {
            return true;
        }
        return false;
    }
}
