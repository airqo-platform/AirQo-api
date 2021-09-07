package airqo;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.gson.annotations.Expose;
import com.google.gson.annotations.SerializedName;
import airqo.models.TransformedMeasurement;
import lombok.Getter;
import lombok.Setter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.Serializable;
import java.net.URI;
import java.net.URL;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.text.SimpleDateFormat;
import java.time.Duration;
import java.util.*;

public class Calibrate {

    private static final Logger logger = LoggerFactory.getLogger(Calibrate.class);

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CalibrateResponse implements Serializable {

        @SerializedName("device_id")
        @Expose
        @JsonAlias({"device_id", "device"})
        String device;

        @SerializedName("calibrated_value")
        @Expose
        @JsonAlias({"calibrated_value", "calibratedValue"})
        Double calibratedValue;

        public CalibrateResponse() {
        }

        public String getDevice() {
            return device;
        }

        public void setDevice(String device) {
            this.device = device;
        }

        public Double getCalibratedValue() {
            return calibratedValue;
        }

        public void setCalibratedValue(Double calibratedValue) {
            this.calibratedValue = calibratedValue;
        }
    }

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CalibratedBody {
        private String datetime;
        private List<HashMap<String, Object>> raw_values;

        public CalibratedBody(TransformedMeasurement transformedMeasurement) {
            this.setDatetime(transformedMeasurement.getTime());
            List<HashMap<String, Object>> list  = new ArrayList<>();
            list.add(new HashMap<>(){{
                put("device_id", transformedMeasurement.getDevice());
                put("pm2.5", transformedMeasurement.getPm2_5().getValue());
                put("pm10", transformedMeasurement.getPm10().getValue());
                put("temperature", transformedMeasurement.getExternalTemperature().getValue());
                put("humidity", transformedMeasurement.getExternalHumidity().getValue());
            }});
            this.setRaw_values(list);
        }
    }

    public static Double getCalibratedValue(TransformedMeasurement transformedMeasurement, String urlString) throws IOException {

        if(transformedMeasurement == null)
            throw new IOException("Invalid Measurements");

        new URL(urlString);

        List<CalibrateResponse> calibrateResponseList = new ArrayList<>();

        try {

            CalibratedBody body = new CalibratedBody(transformedMeasurement);
            SimpleDateFormat simpleDateFormat = new SimpleDateFormat();
            simpleDateFormat.setTimeZone(TimeZone.getTimeZone("UTC"));

            ObjectMapper objectMapper = new ObjectMapper();
            String requestBody = objectMapper
                    .writerWithDefaultPrettyPrinter()
                    .writeValueAsString(body);

            logger.info("Calibrate Url => {}", urlString);
            logger.info("Calibrate Request Body => {}", requestBody);

            HttpClient httpClient = HttpClient.newBuilder()
                    .build();
            HttpRequest request = HttpRequest.newBuilder()
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .timeout(Duration.ofMinutes(4))
                    .uri(URI.create(urlString))
                    .setHeader("Accept", "application/json")
                    .setHeader("Content-Type", "application/json")
                    .build();

            HttpResponse<String> httpResponse = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if(httpResponse.statusCode() != 200){
                logger.error("Calibrate Response Body => {}", httpResponse.body());
                return null;
            }

            calibrateResponseList = objectMapper.readValue(httpResponse.body(), new TypeReference<>() {});

        }
        catch (Exception e){
            e.printStackTrace();
        }

        return calibrateResponseList.isEmpty() ? null : calibrateResponseList.get(0).getCalibratedValue();
    }
}
