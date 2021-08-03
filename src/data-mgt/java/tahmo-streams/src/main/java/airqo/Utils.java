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
    public static SimpleDateFormat stationDateFormat = new SimpleDateFormat("yyyy-MM-dd'T'hh:mm:ss'Z'");
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

        int interval = Integer.parseInt(props.getProperty("interval", "48"));

        List<Measurement> measurements = deviceMeasurements.getMeasurements();

        List<Measurement> measurementList = new ArrayList<>();
        for( Measurement measurement : measurements){

            Optional<Site> deviceSite = sites.stream().filter(
                    site -> site.get_id().trim().equalsIgnoreCase(measurement.getSiteId().toString().trim())).findFirst();

            try {
                if (deviceSite.isPresent()){

                    Site.NearestStation station = deviceSite.get().getNearestStation();
                    Date endTime = dateFormat.parse(measurement.getTime().toString());
                    Date startTime = DateUtils.addHours(endTime, -interval);

                    StationResponse stationResponse = getStationMeasurements2(
                            props, station.getCode(), startTime, endTime, station.getTimezone());

                    List<StationMeasurement2> stationMeasurement2s = stationResponseToMeasurements(stationResponse);

                    Optional<StationMeasurement2> stationTemp = stationMeasurement2s.stream().filter(stationMeasurement2 -> stationMeasurement2.getVariable().equals(Variable.TEMPERATURE)).reduce((measurement1, measurement2) -> {
                        if (measurement1.getTime().after(measurement2.getTime()))
                            return measurement1;
                        return measurement2;
                    });

                    Optional<StationMeasurement2> stationHumidity = stationMeasurement2s.stream().filter(stationMeasurement2 -> stationMeasurement2.getVariable().equals(Variable.HUMIDITY)).reduce((measurement1, measurement2) -> {
                        if (measurement1.getTime().after(measurement2.getTime()))
                            return measurement1;
                        return measurement2;
                    });

                    measurement.getExternalHumidity().setValue(stationHumidity.orElseThrow().getValue());
                    measurement.getExternalTemperature().setValue(stationTemp.orElseThrow().getValue());

                    logger.info("Device : {} , Old Hum : {} , New Hum {}",
                            measurement.getDevice().toString(),
                            measurement.getExternalHumidity().getValue(),
                            stationHumidity.orElseThrow().getValue());
                    logger.info("Device : {} , Old Temp : {} , New Temp {}",
                            measurement.getDevice().toString(),
                            measurement.getExternalTemperature().getValue(),
                            stationTemp.orElseThrow().getValue());
                }
            } catch (Exception e) {
                e.printStackTrace();
            }

            measurementList.add(measurement);

        }

        return TransformedDeviceMeasurements.newBuilder().setMeasurements(measurementList).build();
    }

    public static TransformedDeviceMeasurements batchAddHumidityAndTemp(TransformedDeviceMeasurements deviceMeasurements, Properties props){

        List<Site> sites = Utils.getSites(props.getProperty("airqo.base.url"), props.getProperty("tenant"));
        List<Measurement> measurements = deviceMeasurements.getMeasurements();
        int interval = Integer.parseInt(props.getProperty("interval", "1"));

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
            return deviceMeasurements;
        }

        StationData stationData = new StationData();

        for (Site site :sites){
            StationData stationResponse = getStationMeasurements(props, site.getNearestStation().getCode(),
                    startTime, endTime, site.getNearestStation().getTimezone());
            stationData.getMeasurements().addAll(stationResponse.getMeasurements());
        }

        List<Measurement> measurementList = new ArrayList<>();

        for(Measurement measurement : measurements){

            List<StationMeasurement> stationMeasurements = stationData.getMeasurements().stream().filter(stationMeasurement -> {

                Optional<Site> optionalSite = sites.stream()
                        .filter(site -> site.get_id().equalsIgnoreCase(measurement.getSiteId().toString()))
                        .findFirst();

                String timezone = "Africa/Nairobi";
                if(optionalSite.isPresent())
                    timezone = optionalSite.get().getNearestStation().getTimezone();

                stationDateFormat.setTimeZone(TimeZone.getTimeZone(timezone));

                Date stationTime;
                Date measurementStartTime;
                Date measurementEndTime;


                try {
                    stationTime = stationDateFormat.parse(measurement.getTime().toString());
                    measurementStartTime = DateUtils.addHours(dateFormat.parse(measurement.getTime().toString()), -12);
                    measurementEndTime = DateUtils.addHours(dateFormat.parse(measurement.getTime().toString()), 3);

                    return (stationMeasurement.getCode().equalsIgnoreCase(measurement.getSiteId().toString()) &&
                            stationTime.before(measurementEndTime) && stationTime.after(measurementStartTime));

                } catch (ParseException e) {
                    e.printStackTrace();
                }

                return false;

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

            stationHumidity.ifPresent(stationMeasurement -> {
                double oldValue = measurement.getExternalHumidity().getValue();

                measurement.getExternalHumidity().setValue(stationMeasurement.getHumidity());
                logger.info("Device : {} , Old Hum : {} , New Hum {}",
                        measurement.getDevice().toString(),
                        oldValue,
                        measurement.getExternalHumidity().getValue());
            });

            stationTemp.ifPresent(stationMeasurement -> {
                double oldValue = measurement.getExternalTemperature().getValue();
                measurement.getExternalTemperature().setValue(stationMeasurement.getTemperature());
                logger.info("Device : {} , Old Temp : {} , New Temp {}",
                        measurement.getDevice().toString(),
                        oldValue,
                        measurement.getExternalTemperature().getValue());

            });

            measurementList.add(measurement);
        }

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

        logger.info("\n ====> Sites : {}\n", sitesResponse.getSites());
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

    public static List<StationMeasurement2> stationResponseToMeasurements(StationResponse stationResponse){

        List<StationMeasurement2> measurements = new ArrayList<>();
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

                        StationMeasurement2 measurement = new StationMeasurement2(dateTime, value, variable);
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

    public static StationResponse getStationMeasurements2(Properties props, String stationCode, Date startTime,
                                                         Date endTime, String stationTimeZone){

        logger.info("\n\n********** Fetching Station Data **************\n");

        StationResponse stationResponse;

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

            stationResponse = objectMapper.readValue(httpResponse.body(), new TypeReference<>() {});
            return stationResponse;
        }
        catch (Exception e){
            e.printStackTrace();
            return new StationResponse();
        }

    }

}
