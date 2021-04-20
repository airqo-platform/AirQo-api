package net.airqo.connectors.tasks;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import net.airqo.connectors.config.KccaSourceConnectorConfig;
import net.airqo.connectors.models.KccaDevice;
import net.airqo.connectors.models.RawMeasurements;
import net.airqo.connectors.versions.VersionUtil;

import org.apache.kafka.connect.data.Schema;
import org.apache.kafka.connect.data.SchemaBuilder;
import org.apache.kafka.connect.source.SourceRecord;
import org.apache.kafka.connect.source.SourceTask;
import org.json.JSONArray;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.lang.reflect.Type;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.*;

public class KccaSourceTask extends SourceTask {

    static final Logger log = LoggerFactory.getLogger(KccaSourceTask.class);

    public static final String URL = "url";
    public static final String LAST_READ = "last_read";
    public static final String DEVICE_CODES = "device_codes";

    private String topic;
    private String deviceCodes;
    private String apiKey;
    private String clarityBaseUrl;

    public static final Schema RawMeasurementsSchema = SchemaBuilder.struct()
//            .name(RawMeasurements.class.getSimpleName())
            .field("location", SchemaBuilder.map(Schema.STRING_SCHEMA, SchemaBuilder.array(Schema.OPTIONAL_FLOAT64_SCHEMA)).build())
            .field("characteristics", SchemaBuilder.map(Schema.STRING_SCHEMA, SchemaBuilder.map(Schema.STRING_SCHEMA, Schema.OPTIONAL_FLOAT64_SCHEMA)).build())
            .field("_id", Schema.STRING_SCHEMA)
            .field("recId", Schema.STRING_SCHEMA)
            .field("time", Schema.STRING_SCHEMA)
            .field("device", Schema.STRING_SCHEMA)
            .field("deviceCode", Schema.STRING_SCHEMA)
            .build();

    @Override
    public String version() {
        return VersionUtil.getVersion();
    }

    @Override
    public void start(Map<String, String> props) {

        setupTaskConfig(props);
    }

    private void setupTaskConfig(Map<String, String> props) {

        topic = props.get(KccaSourceConnectorConfig.TOPIC_CONFIG);
        apiKey = props.get(KccaSourceConnectorConfig.CLARITY_API_KEY);
        clarityBaseUrl = props.get(KccaSourceConnectorConfig.CLARITY_API_BASE_URL);

    }

    @Override
    public List<SourceRecord> poll() throws InterruptedException {

        try {

            ArrayList<SourceRecord> records = new ArrayList<SourceRecord>();

            if(this.deviceCodes == null || this.deviceCodes.trim().equals(""))
                this.deviceCodes = getDeviceCodes();

            log.info("\n***************** Fetching Data *************\n");

            Date currentTime = new Date(System.currentTimeMillis() - 14400 * 1000 );

            SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd");
            SimpleDateFormat simpleTimeFormat = new SimpleDateFormat("HH:mm:ss");


            String startTime = simpleDateFormat.format(currentTime) + "T" + simpleTimeFormat.format(currentTime) + "Z";

            String urlString = clarityBaseUrl + "measurements?startTime=" + startTime + "&code=" + deviceCodes + "&limit=" + 2;

            URL url = new URL(urlString);

            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("x-api-key", apiKey);


            conn.connect();

            int responseCode = conn.getResponseCode();

            if(responseCode == 200){

                BufferedReader in = new BufferedReader(
                        new InputStreamReader(conn.getInputStream()));

                StringBuilder sb = new StringBuilder();
//                Gson gson = new Gson();
                String line;

                while ((line = in.readLine()) != null) {
                    sb.append(line);

                    Map sourcePartition = buildSourcePartition();
                    Map sourceOffset = buildSourceOffset(currentTime.toString(), deviceCodes);
                    records.add(new SourceRecord(sourcePartition, sourceOffset, topic, Schema.STRING_SCHEMA, line ));
                }


//                while ((line = in.readLine()) != null) {
//                    sb.append(line);
//                }
//
//                JSONArray jsonArray = new JSONArray(sb.toString());
//
//                try {
//                    System.out.println("=====================111111=====================");
//                    Type listType = new TypeToken<List<RawMeasurements>>() {}.getType();
//                    List<RawMeasurements> deviceMeasurements = gson.fromJson(String.valueOf(jsonArray), listType);
//                    System.out.println("=====================2222222=====================");
//                    for (RawMeasurements measurement: deviceMeasurements){
//
//                        Map sourcePartition = buildSourcePartition();
//                        Map sourceOffset = buildSourceOffset(currentTime.toString(), deviceCodes);
//
//                        System.out.println(measurement);
//                        System.out.println("=====================333333=====================");
//                        records.add(new SourceRecord(sourcePartition, sourceOffset, topic, Schema.STRING_SCHEMA, measurement));
//
//                        System.out.println("=====================Success=====================");
//                    }
//                }
//                catch (Exception ex){
//                    ex.printStackTrace();
//                }

                conn.disconnect();

                if(records.isEmpty()){
                    return new ArrayList<>();
                }
                else{
                    System.out.println("=====================Posting Data=====================");
//                    System.out.println(records);
                    return records;
                }

            }

            conn.disconnect();

        }
        catch (IOException e) {
            e.printStackTrace();
        }

        return new ArrayList<>();
    }

    private Map<String, String> buildSourcePartition() {
        return Collections.singletonMap(URL, clarityBaseUrl);
    }

    private Map<String, Object> buildSourceOffset(String nextRead, String deviceCodes) {
        Map<String, Object> sourceOffset = new HashMap<String, Object>();
        sourceOffset.put(LAST_READ, nextRead);
        sourceOffset.put(DEVICE_CODES, deviceCodes);
        return sourceOffset;
    }

    private String getDeviceCodes(){

        log.info("\n********** Fetching Device codes **************\n");

        String deviceCodes = "";
        try {

            String urlString = clarityBaseUrl + "devices";
            java.net.URL url = new URL(urlString);

            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("x-api-key", apiKey);

            conn.connect();

            int responseCode = conn.getResponseCode();

            if(responseCode == 200){

                BufferedReader in = new BufferedReader(
                        new InputStreamReader(conn.getInputStream()));
                Gson gson = new Gson();
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = in.readLine()) != null) {
                    sb.append(line);
                }

                JSONArray jsonArray = new JSONArray(sb.toString());

                Type listType = new TypeToken<List<KccaDevice>>() {}.getType();
                List<KccaDevice> deviceData = gson.fromJson(jsonArray.toString(), listType);
                for (KccaDevice data: deviceData){
                    deviceCodes += data.getCode() + ",";
                }

                if (deviceCodes.length() > 0 && deviceCodes.charAt(deviceCodes.length() - 1) == ',') {
                    deviceCodes = deviceCodes.substring(0, deviceCodes.length() - 1);
                }
            }

            conn.disconnect();


        } catch (IOException e) {
            e.printStackTrace();
        }

        log.info("\nDevice codes : {}\n", deviceCodes);
        return deviceCodes;
    }

    @Override
    public void stop() {

    }


//    private void initOffsets() {
//
//        log.info("\n***************** Getting Offsets *************\n");
//
//        Map<String, Object> persistedMap = null;
//        if (context != null && context.offsetStorageReader() != null) {
//            persistedMap = context.offsetStorageReader().offset(Collections.singletonMap(URL, baseUrl));
//        }
//        log.info("\nThe persistedMap is {}\n", persistedMap);
//        if (persistedMap != null) {
//
//            String lastRead = (String) persistedMap.get(LAST_READ);
//            if (isNotNullOrBlank(lastRead)) {
//                fromDate = lastRead;
//            }
//
//            Object deviceCodes = persistedMap.get(DEVICE_CODES);
//            if (deviceCodes != null) {
//                this.deviceCodes = (String) deviceCodes;
//            }
//        }
//
//        if(this.deviceCodes == null)
//            this.deviceCodes = getDeviceCodes();
//    }




//    static boolean isNotNullOrBlank(String str) {
//        return str != null && !(str.trim().equals(""));
//    }
}


