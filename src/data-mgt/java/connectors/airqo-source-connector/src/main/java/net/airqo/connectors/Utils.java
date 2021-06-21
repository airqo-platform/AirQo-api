package net.airqo.connectors;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import net.airqo.models.AirqoDevice;
import net.airqo.models.RawMeasurement;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.lang.reflect.Type;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;

public class Utils {

    static final Logger logger = LoggerFactory.getLogger(Utils.class);


    public static List<AirqoDevice> getDevices(String apiUrl){

        logger.info("\n\n********** Fetching Devices **************\n");

        List<AirqoDevice> devices = new ArrayList<>();
        try {

            String urlString = apiUrl + "devices?tenant=airqo";
            logger.info("\n ====> Url : {}\n", apiUrl);

            java.net.URL url = new URL(urlString);

            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Accept", "application/json");

            conn.connect();

            int responseCode = conn.getResponseCode();

            if(responseCode == 200){

                BufferedReader in = new BufferedReader(
                        new InputStreamReader(conn.getInputStream())
                );

                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = in.readLine()) != null) {
                    sb.append(line);
                }

                JSONObject jsonObject = new JSONObject(sb.toString());

                Gson gson = new Gson();
                Type listType = new TypeToken<List<AirqoDevice>>() {}.getType();
                List<AirqoDevice> devicesData = gson.fromJson(jsonObject.get("devices").toString(), listType);
                devices.addAll(devicesData);

            }

            conn.disconnect();

        } catch (IOException e) {
            e.printStackTrace();
        }

        logger.info("\n ====> Devices : {}\n", devices);
        return devices;
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

//            ObjectMapper objectMapper = new ObjectMapper();
//            RawMeasurement measurements = objectMapper.readValue(httpResponse.body(), RawMeasurement.class);
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
