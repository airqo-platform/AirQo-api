package airqo;

import org.apache.kafka.common.config.AbstractConfig;
import org.apache.kafka.common.config.ConfigDef;

import java.util.HashMap;
import java.util.Map;

public class ConnectorConfig extends AbstractConfig {

    public static final String TOPIC_CONFIG = "topic";
    public static final String POLL_INTERVAL_CONFIG = "pollInterval";
    public static final String AIRQO_BASE_URL = "airqoBaseUrl";
    public static final String BATCH_SIZE_CONFIG = "batchSize";
    public static final String MINIMUM_HOURS_CONFIG = "minimumHours";
    public static final String DEVICES_FETCH_INTERVAL_CONFIG = "devicesFetchInterval";

    public static final String TENANT_CONFIG = "minimumHours";

    public static final String CLARITY_API_KEY = "clarityApiKey";
    public static final String CLARITY_API_BASE_URL = "clarityApiBaseUrl";
    public static final String AVERAGE = "average";


    public static final ConfigDef CONFIG_DEF = new ConfigDef()
            .define(TOPIC_CONFIG, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "The topic to publish data to")
            .define(POLL_INTERVAL_CONFIG, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "Pool Interval")
            .define(AIRQO_BASE_URL, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "AirQo Base url")
            .define(BATCH_SIZE_CONFIG, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "Measurements Batch Size")
            .define(MINIMUM_HOURS_CONFIG, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "Minimum Hours for measurements")
            .define(CLARITY_API_KEY, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "Api key")
            .define(AVERAGE, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "Average")
            .define(TENANT_CONFIG, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "Tenant")
            .define(DEVICES_FETCH_INTERVAL_CONFIG, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "Devices Fetch Interval")
            .define(CLARITY_API_BASE_URL, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "Api Base url");

    public ConnectorConfig(Map<String, ?> props) {
        super(CONFIG_DEF, props);
    }

    public Map<String, String> propertiesWithDefaultsValuesIfMissing() {
        Map<String, ?> unCastProperties = this.values();

        Map<String, String> config = new HashMap<>(unCastProperties.size());
        unCastProperties.forEach((key, valueToBeCast) -> config.put(key, valueToBeCast.toString()));

        return config;
    }
}

