package purpleAir;

import org.apache.kafka.common.config.ConfigDef;
import org.apache.kafka.common.config.ConfigException;
import org.apache.kafka.connect.connector.Task;
import org.apache.kafka.connect.errors.ConnectException;
import org.apache.kafka.connect.source.SourceConnector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class PurpleAirConnector extends SourceConnector {

    private static final Logger log = LoggerFactory.getLogger(PurpleAirConnector.class);

    private Map<String, String> configProperties;

    @Override
    public void start(Map<String, String> props) {

        log.info("Starting up Purple Air Source connector");

        try {
            configProperties = setupPropertiesWithDefaultsIfMissing(props);
        } catch (ConfigException e) {
            throw new ConnectException("Couldn't start PurpleAirConnector due to configuration error", e);
        }
    }

    private Map<String, String> setupPropertiesWithDefaultsIfMissing(Map<String, String> props) {
        return new PurpleAirConnectorConfig(props).propertiesWithDefaultsValuesIfMissing();
    }

    @Override
    public Class<? extends Task> taskClass() {
        return PurpleAirSourceTask.class;
    }

    @Override
    public List<Map<String, String>> taskConfigs(int maxTasks) {

        ArrayList<Map<String, String>> configs = new ArrayList<>(maxTasks);

        Map<String, String> config = new HashMap<>(configProperties);

        configs.add(config);
        return configs;
    }

    @Override
    public void stop() {
    }

    @Override
    public ConfigDef config() {
        return PurpleAirConnectorConfig.CONFIG_DEF;
    }

    @Override
    public String version() {
        return VersionUtil.getVersion();
    }
}
