package net.airqo.connectors;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import net.airqo.connectors.models.RawMeasurements;
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
    private String apiKey;
    private String clarityBaseUrl;
    private String average;
    private String timezone;

    private Long interval;
    private Long last_execution = 0L;

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
        interval = Long.parseLong(props.get(KccaSourceConnectorConfig.POLL_INTERVAL));
        average = props.get(KccaSourceConnectorConfig.AVERAGE);
        timezone = props.get(KccaSourceConnectorConfig.TIME_ZONE);

    }


    public List<SourceRecord> pollSchema() throws InterruptedException {
        ArrayList<SourceRecord> records = new ArrayList<SourceRecord>();

        if (System.currentTimeMillis() > (last_execution + interval)) {

            last_execution = System.currentTimeMillis();

            log.info("\n***************** Fetching Data *************\n");

//                Date currentTime = new Date(System.currentTimeMillis() - 3600 * 1000 );
            Date lastExecutionTime = new Date(last_execution - interval);

            SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd");
            SimpleDateFormat simpleTimeFormat = new SimpleDateFormat("HH:mm");


            String startTime = simpleDateFormat.format(lastExecutionTime) + "T" + simpleTimeFormat.format(lastExecutionTime) + ":00Z";

//                String urlString = clarityBaseUrl + "measurements?startTime=" + startTime + "&average=hour" + "&code=" + deviceCodes + "&limit=" + 2;
            String urlString = clarityBaseUrl + "measurements?startTime=" + startTime + Utils.buildQueryParameters(average, timezone);

            Schema measurementsListSchema = SchemaBuilder.array(
                    SchemaBuilder.struct()
                            .name("net.airqo.models")
                            .field("_id", Schema.STRING_SCHEMA)
                            .field("recId", Schema.STRING_SCHEMA)
                            .field("device", Schema.STRING_SCHEMA)
                            .field("deviceCode", Schema.STRING_SCHEMA)
                            .field("time", Schema.STRING_SCHEMA)
                            .field("average", Schema.OPTIONAL_STRING_SCHEMA)
                            .field("location", SchemaBuilder.struct()
                                    .name("location")
                                    .field("coordinates", SchemaBuilder.array(Schema.FLOAT64_SCHEMA).build())
                                    .field("type", Schema.STRING_SCHEMA)
                                    .build())
                            .field("characteristics", SchemaBuilder.struct()
                                    .name("characteristics")
                                    .field("relHumid", SchemaBuilder.struct()
                                            .name("relHumid")
                                            .field("value", Schema.FLOAT64_SCHEMA)
                                            .field("calibratedValue", Schema.OPTIONAL_FLOAT64_SCHEMA)
                                            .field("raw", Schema.FLOAT64_SCHEMA)
                                            .field("weight", Schema.INT64_SCHEMA)
                                            .build())
                                    .field("temperature", SchemaBuilder.struct()
                                            .name("relHumid")
                                            .field("value", Schema.FLOAT64_SCHEMA)
                                            .field("calibratedValue", Schema.OPTIONAL_FLOAT64_SCHEMA)
                                            .field("raw", Schema.FLOAT64_SCHEMA)
                                            .field("weight", Schema.INT64_SCHEMA)
                                            .build())
                                    .field("no2Conc", SchemaBuilder.struct()
                                            .name("relHumid")
                                            .field("value", Schema.FLOAT64_SCHEMA)
                                            .field("calibratedValue", Schema.OPTIONAL_FLOAT64_SCHEMA)
                                            .field("raw", Schema.FLOAT64_SCHEMA)
                                            .field("weight", Schema.INT64_SCHEMA)
                                            .build())
                                    .field("pm2_5ConcNum", SchemaBuilder.struct()
                                            .name("relHumid")
                                            .field("value", Schema.FLOAT64_SCHEMA)
                                            .field("calibratedValue", Schema.OPTIONAL_FLOAT64_SCHEMA)
                                            .field("raw", Schema.FLOAT64_SCHEMA)
                                            .field("weight", Schema.INT64_SCHEMA)
                                            .build())
                                    .field("pm2_5ConcMass", SchemaBuilder.struct()
                                            .name("relHumid")
                                            .field("value", Schema.FLOAT64_SCHEMA)
                                            .field("calibratedValue", Schema.OPTIONAL_FLOAT64_SCHEMA)
                                            .field("raw", Schema.FLOAT64_SCHEMA)
                                            .field("weight", Schema.INT64_SCHEMA)
                                            .build())
                                    .field("pm1ConcNum", SchemaBuilder.struct()
                                            .name("relHumid")
                                            .field("value", Schema.FLOAT64_SCHEMA)
                                            .field("calibratedValue", Schema.OPTIONAL_FLOAT64_SCHEMA)
                                            .field("raw", Schema.FLOAT64_SCHEMA)
                                            .field("weight", Schema.INT64_SCHEMA)
                                            .build())
                                    .field("pm1ConcMass", SchemaBuilder.struct()
                                            .name("relHumid")
                                            .field("value", Schema.FLOAT64_SCHEMA)
                                            .field("calibratedValue", Schema.OPTIONAL_FLOAT64_SCHEMA)
                                            .field("raw", Schema.FLOAT64_SCHEMA)
                                            .field("weight", Schema.INT64_SCHEMA)
                                            .build())
                                    .field("pm10ConcNum", SchemaBuilder.struct()
                                            .name("relHumid")
                                            .field("value", Schema.FLOAT64_SCHEMA)
                                            .field("calibratedValue", Schema.OPTIONAL_FLOAT64_SCHEMA)
                                            .field("raw", Schema.FLOAT64_SCHEMA)
                                            .field("weight", Schema.INT64_SCHEMA)
                                            .build())
                                    .field("pm10ConcMass", SchemaBuilder.struct()
                                            .name("relHumid")
                                            .field("value", Schema.FLOAT64_SCHEMA)
                                            .field("calibratedValue", Schema.OPTIONAL_FLOAT64_SCHEMA)
                                            .field("raw", Schema.FLOAT64_SCHEMA)
                                            .field("weight", Schema.INT64_SCHEMA)
                                            .build())
                                    .build())
                            .build()
            ).build();


            List<RawMeasurements> measurements =  Utils.getMeasurements(urlString, apiKey);

            Gson gson = new Gson();
            Type listType = new TypeToken<List<RawMeasurements>>() {}.getType();
            JSONArray jsonArray = new JSONArray(measurements);
            String data = gson.toJson(measurements, listType);

            Map sourcePartition = buildSourcePartition();
            Map sourceOffset = buildSourceOffset(lastExecutionTime.toString(), urlString);
            records.add(new SourceRecord(sourcePartition, sourceOffset, topic, measurementsListSchema, jsonArray));


            if(records.isEmpty()){
                return new ArrayList<>();
            }
            else{
                return records;
            }

        }
        return new ArrayList<>();
    }

    @Override
    public List<SourceRecord> poll() throws InterruptedException {
        ArrayList<SourceRecord> records = new ArrayList<SourceRecord>();

        if (System.currentTimeMillis() > (last_execution + interval)) {

            last_execution = System.currentTimeMillis();

            try {

                log.info("\n***************** Fetching Data *************\n");

//                Date currentTime = new Date(System.currentTimeMillis() - 3600 * 1000 );
                Date lastExecutionTime = new Date(last_execution - interval);
//
//                SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd");
//                SimpleDateFormat simpleTimeFormat = new SimpleDateFormat("HH:mm");
//
//
//                String startTime = simpleDateFormat.format(lastExecutionTime) + "T" + simpleTimeFormat.format(lastExecutionTime) + ":00Z";

                String urlString = String.format("%smeasurements?%s", clarityBaseUrl, Utils.buildQueryParameters(average, timezone));

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
                    String line;

                    while ((line = in.readLine()) != null) {
                        sb.append(line);

                        Map sourcePartition = buildSourcePartition();
                        Map sourceOffset = buildSourceOffset(lastExecutionTime.toString(), urlString);
                        records.add(new SourceRecord(sourcePartition, sourceOffset, topic, Schema.STRING_SCHEMA, line ));
                    }

                    conn.disconnect();

                    if(records.isEmpty()){
                        return new ArrayList<>();
                    }
                    else{
                        return records;
                    }

                }

                conn.disconnect();

            }
            catch (IOException e) {
                e.printStackTrace();
            }

        }

//        else{
//            log.info("\n***************** Time is less *************\n");
//        }
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

