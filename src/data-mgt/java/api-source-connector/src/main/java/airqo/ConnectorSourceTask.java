package airqo;

import airqo.models.AirqoDevice;
import airqo.models.AirQoRawMeasurement;
import airqo.models.KccaRawMeasurement;
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

public class ConnectorSourceTask extends SourceTask {

    static final Logger logger = LoggerFactory.getLogger(ConnectorSourceTask.class);

    private static final String AIRQO_BASE_URL = "airqoBaseUrl";
    private static final String LAST_READ = "lastRead";
    private final SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd'T'hh:mm:ss'Z'");
    private final SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd'T'hh:mm:ss'Z'");

    private String topic;
    private String airqoBaseUrl;
    private int interval;
    private int batchSize;
    private int minimumHours;
    private int devicesFetchInterval;
    private String apiKey;
    private String clarityBaseUrl;
    private String average;
    private String tenant;

    private Date nextExecution = new Date(System.currentTimeMillis());
    private Date nextDevicesFetch = new Date(System.currentTimeMillis());
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

        topic = props.get(ConnectorConfig.TOPIC_CONFIG);
        airqoBaseUrl = props.get(ConnectorConfig.AIRQO_BASE_URL);
        tenant = props.get(ConnectorConfig.TOPIC_CONFIG);
        batchSize = Integer.parseInt(props.get(ConnectorConfig.BATCH_SIZE_CONFIG));
        interval = Integer.parseInt(props.get(ConnectorConfig.POLL_INTERVAL_CONFIG));
        minimumHours = -(Integer.parseInt(props.get(ConnectorConfig.MINIMUM_HOURS_CONFIG)));
        simpleDateFormat.setTimeZone(TimeZone.getTimeZone("UTC"));
        devicesFetchInterval =  Integer.parseInt(props.get(ConnectorConfig.DEVICES_FETCH_INTERVAL_CONFIG));

        apiKey = props.get(ConnectorConfig.CLARITY_API_KEY);
        clarityBaseUrl = props.get(ConnectorConfig.CLARITY_API_BASE_URL);
        average = props.get(ConnectorConfig.AVERAGE);
    }

    @Override
    public List<SourceRecord> poll() {
        ArrayList<SourceRecord> records = new ArrayList<>();
        logger.info("Hello There");

        if (new Date(System.currentTimeMillis()).after(nextExecution)) {

            nextExecution = DateUtils.addMilliseconds(new Date(System.currentTimeMillis()), interval);

            switch (tenant.trim().toLowerCase()){
                case "airqo":
                    records = getAirQoMeasurements();
                    break;
                case "kcca":
                    records = getKccaMeasurements();
                    break;
                default:
                    logger.error("Invalid Tenant => {}", tenant.trim().toLowerCase());
                    System.exit(1);
                    break;
            }

            logger.info("\n\n ====> Records To Be Sent : {}\n\n", records);
            return records.isEmpty() ? new ArrayList<>() : records;

        }
        return new ArrayList<>();
    }

    private ArrayList<SourceRecord> getKccaMeasurements() {

        ArrayList<SourceRecord> records = new ArrayList<>();

        String urlString = String.format("%smeasurements%s", clarityBaseUrl, Utils.buildQueryParameters(average));

        List<KccaRawMeasurement> measurements =  Utils.getKccaMeasurements(urlString, apiKey);

        if(measurements.isEmpty())
            return new ArrayList<>();

        List<List<KccaRawMeasurement>> measurementsLists = Lists.partition(measurements, 10);

        measurementsLists.forEach(rawMeasurements -> {

            String jsonString;
            try {
                ObjectMapper mapper = new ObjectMapper();
                jsonString = mapper.writeValueAsString(rawMeasurements);
                records.add(new SourceRecord(null, null, topic,
                        Schema.STRING_SCHEMA, jsonString));

            } catch (JsonProcessingException e) {
                e.printStackTrace();
            }
        });

        return records;

    }

    private ArrayList<SourceRecord> getAirQoMeasurements() {
        ArrayList<SourceRecord> records = new ArrayList<>();


        if(devices.isEmpty() || (new Date(System.currentTimeMillis()).after(nextDevicesFetch))) {
            nextDevicesFetch = DateUtils.addHours(new Date(System.currentTimeMillis()), devicesFetchInterval);
            List<AirqoDevice> deviceList = getDevices(airqoBaseUrl, tenant);
            devices = deviceList.isEmpty() ? devices : deviceList;
        }

        List<AirQoRawMeasurement> measurementList = new ArrayList<>();

        devices.forEach(airqoDevice -> {

            if(!airqoDevice.getSite().get_id().trim().equals("")){
                String urlString = airqoBaseUrl + "data/feeds/transform/recent?channel=" + airqoDevice.getDeviceNumber();

                AirQoRawMeasurement measurements = Utils.getAirQoMeasurements(urlString);

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

            List<List<AirQoRawMeasurement>> measurementsLists = Lists.partition(measurementList, batchSize);

            measurementsLists.forEach(rawMeasurements -> {

                String jsonString;

                try {
                    ObjectMapper mapper = new ObjectMapper();
                    jsonString = mapper.writeValueAsString(rawMeasurements);

                    SourceRecord sourceRecord = new SourceRecord(null,null, topic,
                            Schema.STRING_SCHEMA, jsonString );

                    records.add(sourceRecord);

                } catch (JsonProcessingException e) {
                    e.printStackTrace();
                }
            });
        }

        return records;

    }

    private Map<String, String> buildSourcePartition() {
        Map<String, String> sourcePartition = new HashMap<>();
        sourcePartition.put(AIRQO_BASE_URL, airqoBaseUrl);
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