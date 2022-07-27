package purpleAir;

import org.apache.kafka.common.config.AbstractConfig;
import org.apache.kafka.common.config.ConfigDef;

import java.util.HashMap;
import java.util.Map;

public class PurpleAirConnectorConfig extends AbstractConfig {

    public static final String TOPIC_CONFIG = "topic";
    public static final String POLL_INTERVAL = "pollInterval";
    public static final String PURPLE_AIR_API_KEY = "purpleAirApiKey";
    public static final String PURPLE_AIR_API_BASE_URL = "purpleAirApiBaseUrl";
    public static final String PURPLE_AIR_TOPIC_GROUP_CONFIG = "purpleAirTopicGroup";
    public static final String PURPLE_AIR_FIELDS_CONFIG = "purpleAirFields";

    public static final ConfigDef CONFIG_DEF = new ConfigDef()
            .define(TOPIC_CONFIG, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "The topic to publish data to")
            .define(PURPLE_AIR_API_KEY, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "Purple Air Read Api key")
            .define(PURPLE_AIR_FIELDS_CONFIG, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "Purple Air Fields")
            .define(POLL_INTERVAL, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "Pool Interval in milliseconds")
            .define(PURPLE_AIR_TOPIC_GROUP_CONFIG, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "Purple Air Group ID")
            .define(PURPLE_AIR_API_BASE_URL, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "Purple Air Api Base url without a slash");


    public PurpleAirConnectorConfig(Map<String, ?> props) {
        super(CONFIG_DEF, props);
    }

    public Map<String, String> propertiesWithDefaultsValuesIfMissing() {
        Map<String, ?> unCastProperties = this.values();

        Map<String, String> config = new HashMap<>(unCastProperties.size());
        unCastProperties.forEach((key, valueToBeCast) -> config.put(key, valueToBeCast.toString()));

        return config;
    }

}