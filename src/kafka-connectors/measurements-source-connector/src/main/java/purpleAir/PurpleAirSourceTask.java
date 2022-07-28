package purpleAir;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.kafka.connect.data.Schema;
import org.apache.kafka.connect.source.SourceRecord;
import org.apache.kafka.connect.source.SourceTask;

import java.util.*;

public class PurpleAirSourceTask extends SourceTask {

    public static final String URL = "url";
    public static final String LAST_READ = "last_read";
    private String topic;
    private String apiKey;
    private String fields;
    private String group;
    private String purpleAirBaseUrl;
    private Long poll_interval;
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
        topic = props.get(PurpleAirConnectorConfig.TOPIC_CONFIG);
        apiKey = props.get(PurpleAirConnectorConfig.PURPLE_AIR_API_KEY);
        purpleAirBaseUrl = props.get(PurpleAirConnectorConfig.PURPLE_AIR_API_BASE_URL);
        poll_interval = Long.parseLong(props.get(PurpleAirConnectorConfig.POLL_INTERVAL));
        group = props.get(PurpleAirConnectorConfig.PURPLE_AIR_TOPIC_GROUP_CONFIG);
        fields = props.get(PurpleAirConnectorConfig.PURPLE_AIR_FIELDS_CONFIG);
    }

    @Override
    public List<SourceRecord> poll() throws InterruptedException {
        ArrayList<SourceRecord> records = new ArrayList<>();

        if (System.currentTimeMillis() > (last_execution + poll_interval)) {

            last_execution = System.currentTimeMillis();

            Date lastExecutionTime = new Date(last_execution - poll_interval);

            String urlString = String.format("%s/groups/%s/members?fields=%s", purpleAirBaseUrl, group, fields);

            PurpleAirData data = Utils.getData(urlString, apiKey);
            ObjectMapper mapper = new ObjectMapper();

            if (data == null) {
                return new ArrayList<>();
            }

            try {
                String jsonString = mapper.writeValueAsString(data);
                Map<String, String> sourcePartition = buildSourcePartition();
                Map<String, Object> sourceOffset = buildSourceOffset(lastExecutionTime.toString());
                records.add(new SourceRecord(sourcePartition, sourceOffset, topic, Schema.STRING_SCHEMA, jsonString));
            } catch (JsonProcessingException e) {
                e.printStackTrace();
            }

            return records.isEmpty() ? new ArrayList<>() : records;
        }

        return new ArrayList<>();
    }

    private Map<String, String> buildSourcePartition() {
        return Collections.singletonMap(URL, purpleAirBaseUrl);
    }

    private Map<String, Object> buildSourceOffset(String nextRead) {
        Map<String, Object> sourceOffset = new HashMap<>();
        sourceOffset.put(LAST_READ, nextRead);
        return sourceOffset;
    }

    @Override
    public void stop() {

    }
}

