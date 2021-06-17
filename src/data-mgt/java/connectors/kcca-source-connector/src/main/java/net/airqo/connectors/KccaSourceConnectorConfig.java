package net.airqo.connectors;

import org.apache.kafka.common.config.AbstractConfig;
import org.apache.kafka.common.config.ConfigDef;

import java.util.HashMap;
import java.util.Map;

public class KccaSourceConnectorConfig extends AbstractConfig {

    public static final String TOPIC_CONFIG = "topic";
    public static final String POLL_INTERVAL = "pollInterval";
    public static final String CLARITY_API_KEY = "clarityApiKey";
    public static final String CLARITY_API_BASE_URL = "clarityApiBaseUrl";
    public static final String AVERAGE = "average";
    public static final String TIME_ZONE = "timezone";

    public static final ConfigDef CONFIG_DEF = new ConfigDef()
            .define(TOPIC_CONFIG, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "The topic to publish data to")
            .define(CLARITY_API_KEY, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "Api key")
            .define(AVERAGE, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "Average")
            .define(TIME_ZONE, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "Timezone")
            .define(POLL_INTERVAL, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "Pool Interval")
            .define(CLARITY_API_BASE_URL, ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "Api Base url");


    public KccaSourceConnectorConfig(Map<String, ?> props) {
        super(CONFIG_DEF, props);
    }

    public Map<String, String> propertiesWithDefaultsValuesIfMissing() {
        Map<String, ?> unCastProperties = this.values();

        Map<String, String> config = new HashMap<>(unCastProperties.size());
        unCastProperties.forEach((key, valueToBeCast) -> config.put(key, valueToBeCast.toString()));

        return config;
    }

}