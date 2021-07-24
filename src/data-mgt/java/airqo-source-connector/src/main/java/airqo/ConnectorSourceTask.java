package airqo;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.collect.Lists;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import airqo.models.AirqoDevice;
import airqo.models.RawMeasurement;
import org.apache.kafka.connect.data.Schema;
import org.apache.kafka.connect.source.SourceRecord;
import org.apache.kafka.connect.source.SourceTask;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static airqo.Utils.getDevices;
import static airqo.Utils.getMeasurements;

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
                devices = getDevices(apiUrl);
            }

            List<RawMeasurement> measurementList = new ArrayList<>();

            devices.forEach(airqoDevice -> {

                if(!airqoDevice.getSite().get_id().trim().equals("")){
                    String urlString = feedsUrl + "data/feeds/transform/recent?channel=" + airqoDevice.getDeviceNumber();

                    RawMeasurement measurements = getMeasurements(urlString);

                    if(measurements != null){

                        measurements.setChannelID(airqoDevice.getDeviceNumber());
                        measurements.setDevice(airqoDevice.getDevice());
                        measurements.setSite_id(airqoDevice.getSite().get_id());

                        logger.info("\nMeasurements Added => {}", measurements);

                        measurementList.add(measurements);

                    }
                }


            });

            if(!measurementList.isEmpty()){

                List<List<RawMeasurement>> measurementsLists = Lists.partition(measurementList, 10);

                measurementsLists.forEach(rawMeasurements -> {

                    String jsonString;

                    try {
                        ObjectMapper mapper = new ObjectMapper();
                        jsonString = mapper.writeValueAsString(rawMeasurements);

                    } catch (JsonProcessingException e) {
                        e.printStackTrace();

                        Gson gson = new Gson();
                        Type dataType = new TypeToken<List<RawMeasurement>>() {}.getType();
                        jsonString = gson.toJson(rawMeasurements, dataType);
                    }

                    SourceRecord sourceRecord = new SourceRecord(
                            null,
                            null,
                            topic, Schema.STRING_SCHEMA, jsonString );

                    records.add(sourceRecord);

                });
            }

            logger.info("\n\n ====> Records To Be Sent : {}\n\n", records);

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
}