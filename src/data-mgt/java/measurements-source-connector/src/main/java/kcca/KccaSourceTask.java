package kcca;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.collect.Lists;
import org.apache.kafka.connect.data.Schema;
import org.apache.kafka.connect.source.SourceRecord;
import org.apache.kafka.connect.source.SourceTask;

import java.util.*;

public class KccaSourceTask extends SourceTask {

    public static final String URL = "url";
    public static final String LAST_READ = "last_read";
    public static final String DEVICE_CODES = "device_codes";

    private String topic;
    private String apiKey;
    private String clarityBaseUrl;
    private String average;
    private int batchSize;

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

        topic = props.get(KccaConnectorConfig.TOPIC_CONFIG);
        apiKey = props.get(KccaConnectorConfig.CLARITY_API_KEY);
        clarityBaseUrl = props.get(KccaConnectorConfig.CLARITY_API_BASE_URL);
        batchSize = Integer.parseInt(props.get(KccaConnectorConfig.BATCH_SIZE_CONFIG));
        interval = Long.parseLong(props.get(KccaConnectorConfig.POLL_INTERVAL));
        average = props.get(KccaConnectorConfig.AVERAGE);

    }

    @Override
    public List<SourceRecord> poll() throws InterruptedException {
        ArrayList<SourceRecord> records = new ArrayList<>();

        if (System.currentTimeMillis() > (last_execution + interval)) {

            last_execution = System.currentTimeMillis();

            Date lastExecutionTime = new Date(last_execution - interval);

            String urlString = String.format("%smeasurements%s", clarityBaseUrl, Utils.buildKccaQueryParameters(average));

            List<KccaRawMeasurement> measurements =  Utils.getMeasurements(urlString, apiKey);

            if(measurements.isEmpty())
                return new ArrayList<>();

            List<List<KccaRawMeasurement>> measurementsLists = Lists.partition(measurements, batchSize);

            measurementsLists.forEach(rawMeasurements -> {

                String jsonString;
                try {
                    ObjectMapper mapper = new ObjectMapper();
                    jsonString = mapper.writeValueAsString(rawMeasurements);
                    Map<String, String> sourcePartition = buildSourcePartition();
                    Map<String, Object> sourceOffset = buildSourceOffset(lastExecutionTime.toString(), urlString);
                    records.add(new SourceRecord(sourcePartition, sourceOffset, topic, Schema.STRING_SCHEMA, jsonString));

                } catch (JsonProcessingException e) {
                    e.printStackTrace();
                }
            });

            return records.isEmpty() ? new ArrayList<>() : records;
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

    @Override
    public void stop() {

    }
}

