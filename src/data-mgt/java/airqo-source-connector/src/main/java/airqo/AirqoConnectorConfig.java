package airqo;

import org.apache.kafka.common.config.AbstractConfig;
import org.apache.kafka.common.config.ConfigDef;

import java.util.HashMap;
import java.util.Map;

public class AirqoConnectorConfig extends AbstractConfig {

    public static final String TOPIC_CONFIG = "topic";
    public static final String POLL_INTERVAL = "pollInterval";
    public static final String API_BASE_URL = "airqoBaseUrl";
    public static final String BATCH_SIZE = "batchSize";
    public static final String MINIMUM_HOURS = "minimumHours";


    public static final ConfigDef CONFIG_DEF = new ConfigDef()
            .define(TOPIC_CONFIG, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "The topic to publish data to")
            .define(POLL_INTERVAL, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "Pool Interval")
            .define(API_BASE_URL, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "AirQo Base url")
            .define(BATCH_SIZE, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "Measurements Batch Size")
            .define(MINIMUM_HOURS, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "Minimum Hours for measurements");

    public AirqoConnectorConfig(Map<String, ?> props) {
        super(CONFIG_DEF, props);
    }

    public Map<String, String> propertiesWithDefaultsValuesIfMissing() {
        Map<String, ?> unCastProperties = this.values();

        Map<String, String> config = new HashMap<>(unCastProperties.size());
        unCastProperties.forEach((key, valueToBeCast) -> config.put(key, valueToBeCast.toString()));

        return config;
    }
}

