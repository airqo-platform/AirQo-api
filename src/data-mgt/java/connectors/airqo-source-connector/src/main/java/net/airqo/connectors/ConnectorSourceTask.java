package net.airqo.connectors;


import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import net.airqo.models.AirqoDevice;
import org.apache.kafka.connect.data.Schema;
import org.apache.kafka.connect.source.SourceRecord;
import org.apache.kafka.connect.source.SourceTask;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.lang.reflect.Type;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.*;

public class ConnectorSourceTask extends SourceTask {

    static final Logger logger = LoggerFactory.getLogger(ConnectorSourceTask.class);

    private static final String AIRQO_URL = "airqoUrl";
    private static final String FEEDS_URL = "feedsUrl";
    private static final String LAST_READ = "lastRead";
    private static final Long DEVICES_FETCH_INTERVAL = 0L;

    private String topic;
    private String apiUrl;
    private String feedsUrl;
    private Long interval;

    private Long lastExecution = 0L;
    private Long lastDevicesFetch = 0L;
    private  List<AirqoDevice> devices = new ArrayList<>();

    @Override
    public String version() {
        return VersionUtil.getVersion();
    }

    @Override
    public void start(Map<String, String> props) {

        setupTaskConfig(props);
    }

    private void setupTaskConfig(Map<String, String> props) {

        topic = props.get(AirqoConnectorConfig.TOPIC_CONFIG);
        apiUrl = props.get(AirqoConnectorConfig.API_BASE_URL);
        feedsUrl = props.get(AirqoConnectorConfig.FEEDS_BASE_URL);
        interval = Long.parseLong(props.get(AirqoConnectorConfig.POLL_INTERVAL));

    }

    @Override
    public List<SourceRecord> poll() {
        ArrayList<SourceRecord> records = new ArrayList<>();

        if (System.currentTimeMillis() > (lastExecution + interval)) {

            lastExecution = System.currentTimeMillis();

//            Date lastExecutionTime = new Date(lastExecution - interval);

            if(devices.isEmpty() || (System.currentTimeMillis() > (lastDevicesFetch + DEVICES_FETCH_INTERVAL))) {
                lastDevicesFetch = System.currentTimeMillis();
                devices = getDevices();
            }

            devices.forEach(airqoDevice -> {

                String urlString = feedsUrl + "data/feeds/transform/recent?channel=" + airqoDevice.getChannelId();

                String measurements = getMeasurements(urlString);

                if(!measurements.isEmpty()){
                    SourceRecord sourceRecord = new SourceRecord(
                            null,
                            null,
                            topic,
                            Schema.STRING_SCHEMA,
                            measurements
                    );

                    records.add(sourceRecord);
                }

            });

            logger.info("\n\n ====> Records Sent : {}\n\n", records);

            return records.isEmpty() ? new ArrayList<>() : records;

        }
        return new ArrayList<>();
    }

    private Map<String, String> buildSourcePartition() {
        Map<String, String> sourcePartition = new HashMap<>();
        sourcePartition.put(AIRQO_URL, apiUrl);
        sourcePartition.put(FEEDS_URL, feedsUrl);
        return sourcePartition;

    }

    private Map<String, Object> buildSourceOffset(String nextRead) {
        Map<String, Object> sourceOffset = new HashMap<>();
        sourceOffset.put(LAST_READ, nextRead);
        return sourceOffset;
    }

    @Override
    public void stop() {

    }

    private List<AirqoDevice> getDevices(){

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

    private String getMeasurements(String stringUrl){

        logger.info("\n\n**************** Fetching Measurements *************\n");
        logger.info("\n ====> Url : {}\n", stringUrl);

        StringBuilder sb = new StringBuilder();

        try {

            URL url = new URL(stringUrl);

            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Accept", "application/json");

            conn.connect();

            int responseCode = conn.getResponseCode();

            if(responseCode == 200){

                BufferedReader in = new BufferedReader(
                        new InputStreamReader(conn.getInputStream()));

                String line;

                while ((line = in.readLine()) != null) {
                    sb.append(line);
                }

                conn.disconnect();
            }
            conn.disconnect();
        }
        catch (IOException e) {
            e.printStackTrace();
        }
        logger.info("\n ====> Measurements : {}\n", sb);

        return sb.toString();
    }

}



