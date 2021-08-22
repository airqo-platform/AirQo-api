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

    public static Properties loadEnvProperties(String propertiesFile){

        if(propertiesFile == null)
            propertiesFile = "application.properties";

        Properties props = new Properties();

        try (InputStream input = Utils.class.getClassLoader().getResourceAsStream(propertiesFile)) {
            props.load(input);
        }
        catch (Exception ex){
            logger.error("Error loading properties file `{}` : {}", propertiesFile, ex.toString());
        }

        Set<String> systemKeys = System.getenv().keySet();

        for(String envKey : systemKeys){
            if (System.getenv(envKey) != null){
                String propKey = envKey.trim().toLowerCase();
                props.setProperty(propKey, System.getenv(envKey));
            }
        }

        return props;
    }

    public static TransformedDeviceMeasurements addHumidityAndTemp(TransformedDeviceMeasurements deviceMeasurements, Properties props){

        List<Site> sites = Utils.getSites(props.getProperty("airqo.base.url"), props.getProperty("tenant"));
        Set<Site> filteredSites = new HashSet<>();

        List<Measurement> measurements = deviceMeasurements.getMeasurements();

        measurements.forEach(measurement -> {
            try {
                String siteId = measurement.getSiteId().toString();
                Site site = sites.stream().filter(site1 -> site1.get_id().equalsIgnoreCase(siteId)).findFirst().orElseThrow();
                filteredSites.add(site);
            } catch (Exception e) {
                e.printStackTrace();
            }
        });

        int interval = Integer.parseInt(props.getProperty("interval", "6"));

        Optional<Measurement> startMeasurement = measurements.stream().reduce((measurement1, measurement2) -> {
            try {
                Date measurement1Time = dateFormat.parse(measurement1.getTime().toString());
                Date measurement2Time = dateFormat.parse(measurement2.getTime().toString());

                if (measurement1Time.before(measurement2Time))
                    return measurement1;
                return measurement2;

            } catch (ParseException e) {
                e.printStackTrace();
            }
            return measurement1;
        });

        Optional<Measurement> endMeasurement = measurements.stream().reduce((measurement1, measurement2) -> {
            try {
                Date measurement1Time = dateFormat.parse(measurement1.getTime().toString());
                Date measurement2Time = dateFormat.parse(measurement2.getTime().toString());

                if (measurement1Time.after(measurement2Time))
                    return measurement1;
                return measurement2;

            } catch (ParseException e) {
                e.printStackTrace();
            }
            return measurement1;
        });
        Date startTime, endTime;

        try {

            if(!(startMeasurement.isPresent() && endMeasurement.isPresent())){
                throw new Exception("Not present");
            }

            startTime = DateUtils.addHours(dateFormat.parse(startMeasurement.get().getTime().toString()), -interval);
            endTime = dateFormat.parse(endMeasurement.get().getTime().toString());
        } catch (Exception e) {
            e.printStackTrace();
            return new TransformedDeviceMeasurements();
        }

        StationData stationData = new StationData();

        for (Site site :filteredSites){
            StationData stationResponse = getStationMeasurements(props, site.getNearestStation().getCode(),
                    startTime, endTime, site.getNearestStation().getTimezone());
            stationData.getMeasurements().addAll(stationResponse.getMeasurements());
        }

        List<Measurement> measurementList = new ArrayList<>();

        for(Measurement measurement : measurements){

            List<StationMeasurement> stationMeasurements = stationData.getMeasurements().stream().filter(stationMeasurement -> {

                Optional<Site> optionalSite = filteredSites.stream()
                        .filter(site -> site.get_id().equalsIgnoreCase(measurement.getSiteId().toString()))
                        .findFirst();

                return optionalSite.filter(site -> stationMeasurement.getCode().equalsIgnoreCase(site.getNearestStation().getCode())).isPresent();

            }).collect(Collectors.toList());

            Optional<StationMeasurement> stationTemp = stationMeasurements
                    .stream()
                    .filter(stationMeasurement2 -> (stationMeasurement2.isNotNull() && stationMeasurement2.isTemperature()))
                    .reduce((measurement1, measurement2) -> {

                if (measurement1.getTime().after(measurement2.getTime()))
                    return measurement1;
                return measurement2;
            });

            Optional<StationMeasurement> stationHumidity = stationMeasurements
                    .stream()
                    .filter(stationMeasurement2 -> (stationMeasurement2.isNotNull() && stationMeasurement2.isHumidity()))
                    .reduce((measurement1, measurement2) -> {
                if (measurement1.getTime().after(measurement2.getTime()))
                    return measurement1;
                return measurement2;
            });

            try {
                stationHumidity.ifPresent(stationMeasurement -> {
                    Double oldValue = measurement.getExternalHumidity().getValue();

                    measurement.getExternalHumidity().setValue(stationMeasurement.getHumidity());
                    logger.info("Device : {} , Old Hum : {} , New Hum {}",
                            measurement.getDevice().toString(),
                            oldValue,
                            measurement.getExternalHumidity().getValue());
                });

                stationTemp.ifPresent(stationMeasurement -> {
                    Double oldValue = measurement.getExternalTemperature().getValue();
                    measurement.getExternalTemperature().setValue(stationMeasurement.getTemperature());
                    logger.info("Device : {} , Old Temp : {} , New Temp {}",
                            measurement.getDevice().toString(),
                            oldValue,
                            measurement.getExternalTemperature().getValue());
                });

            } catch (Exception e) {
                e.printStackTrace();
            }

            if((measurement.getExternalHumidity().getValue() == null &&
                    measurement.getExternalTemperature().getValue() == null) || !hasOutliers(measurement))
                measurementList.add(measurement);
        }

        logger.info("Transformed Measurements : {}", measurementList);

        return TransformedDeviceMeasurements.newBuilder().setMeasurements(measurementList).build();
    }

    public static boolean hasOutliers(Measurement  measurement){

        try {
            if (measurement.getExternalHumidity().getValue() < 0.0 || measurement.getExternalHumidity().getValue() > 99)
                return true;

            if (measurement.getExternalTemperature().getValue() < 0.0 || measurement.getExternalTemperature().getValue() > 45)
                return true;
        } catch (Exception e) {
            e.printStackTrace();
            return true;
        }

        return false;
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

        logger.info("\n ====> Sites : {}\n", sitesResponse.getSites());
        return sitesResponse.getSites();
    }

    public static StationData getStationMeasurements(Properties props, String stationCode, Date startTime,
                                                         Date endTime, String stationTimeZone){

        logger.info("\n\n********** Fetching Station Data **************\n");

        StationData stationData = new StationData();

        try {

            SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd'T'hh:mm:ss'Z'");
            dateFormat.setTimeZone(TimeZone.getTimeZone(stationTimeZone));

            logger.info("{}", dateFormat.format(startTime));
            logger.info("{}", dateFormat.format(endTime));

            String urlString =  String.format("%sservices/measurements/v2/stations/%s/measurements/%s?start=%s&end=%s",
                    props.getProperty("tahmo.base.url") , stationCode, "controlled",
                    dateFormat.format(startTime), dateFormat.format(endTime));

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
            stationData = objectMapper.readValue(httpResponse.body(), StationData.class);

        }
        catch (Exception e){
            e.printStackTrace();
        }

        return stationData;
    }

}
