package airqo;

import airqo.models.AirqoDevice;
import airqo.models.AirqoRawMeasurement;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.collect.Lists;
import org.apache.commons.lang3.time.DateUtils;
import org.apache.kafka.connect.data.Schema;
import org.apache.kafka.connect.source.SourceRecord;
import org.apache.kafka.connect.source.SourceTask;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.text.SimpleDateFormat;
import java.util.*;

import static airqo.Utils.getDevices;
import static airqo.Utils.getMeasurements;

public class AirqoSourceTask extends SourceTask {

    static final Logger logger = LoggerFactory.getLogger(AirqoSourceTask.class);

    private static final String AIRQO_URL = "airqoUrl";
    private static final String LAST_READ = "lastRead";
//    private static final Long DEVICES_FETCH_INTERVAL = 0L;
    private final SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd'T'hh:mm:ss'Z'");
    private final SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd'T'hh:mm:ss'Z'");
    private String topic;
    private String airqoBaseUrl;
    private Long interval;
    private Long devicesFetchInterval;
    private int batchSize;
    private int minimumHours;

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
        airqoBaseUrl = props.get(AirqoConnectorConfig.AIRQO_BASE_URL);
        batchSize = Integer.parseInt(props.get(AirqoConnectorConfig.BATCH_SIZE_CONFIG));
        interval = Long.parseLong(props.get(AirqoConnectorConfig.POLL_INTERVAL_CONFIG));
        devicesFetchInterval = Long.parseLong(props.get(AirqoConnectorConfig.DEVICES_FETCH_INTERVAL));
        minimumHours = -(Integer.parseInt(props.get(AirqoConnectorConfig.MINIMUM_HOURS_CONFIG)));
        simpleDateFormat.setTimeZone(TimeZone.getTimeZone("UTC"));
    }

    @Override
    public List<SourceRecord> poll() {
        ArrayList<SourceRecord> records = new ArrayList<>();

        if (System.currentTimeMillis() > (lastExecution + interval)) {
            lastExecution = System.currentTimeMillis();

            if(devices.isEmpty() || (System.currentTimeMillis() > (lastDevicesFetch + devicesFetchInterval))) {
                lastDevicesFetch = System.currentTimeMillis();
                List<AirqoDevice> deviceList = getDevices(airqoBaseUrl);
                if(!deviceList.isEmpty())
                    devices = deviceList;
            }

            List<AirqoRawMeasurement> measurementList = new ArrayList<>();

            devices.forEach(airqoDevice -> {

                if(!airqoDevice.getSite().get_id().trim().equals("")){
                    String urlString = airqoBaseUrl + "data/feeds/transform/recent?channel=" + airqoDevice.getDeviceNumber();

                    AirqoRawMeasurement measurements = getMeasurements(urlString);

                    if(measurements != null){

                        try {
                            Date measurementTime = dateFormat.parse(measurements.getTime());
                            Date minimumDate = DateUtils.addHours(simpleDateFormat.parse(simpleDateFormat.format(new Date(System.currentTimeMillis()))), minimumHours);

                            if(measurementTime.after(minimumDate)){

                                measurements.setChannelID(airqoDevice.getDeviceNumber());
                                measurements.setDevice(airqoDevice.getDevice());
                                measurements.setSite_id(airqoDevice.getSite().get_id());

                                logger.info("\nMeasurements Added => {}", measurements);
                                measurementList.add(measurements);
                            }

                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    }
                }
            });

            if(!measurementList.isEmpty()){

                List<List<AirqoRawMeasurement>> measurementsLists = Lists.partition(measurementList, batchSize);

                measurementsLists.forEach(rawMeasurements -> {

                    String jsonString;

                    try {
                        ObjectMapper mapper = new ObjectMapper();
                        jsonString = mapper.writeValueAsString(rawMeasurements);

                        SourceRecord sourceRecord = new SourceRecord(
                                null,
                                null,
                                topic, Schema.STRING_SCHEMA, jsonString );

                        records.add(sourceRecord);

                    } catch (JsonProcessingException e) {
                        e.printStackTrace();
                    }
                });
            }

            logger.info("\n\n ====> Records To Be Sent : {}\n\n", records);

            return records.isEmpty() ? new ArrayList<>() : records;

        }
        return new ArrayList<>();
    }

    private Map<String, String> buildSourcePartition() {
        Map<String, String> sourcePartition = new HashMap<>();
        sourcePartition.put(AIRQO_URL, airqoBaseUrl);
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