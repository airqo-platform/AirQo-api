package airqo;

import org.apache.kafka.common.config.ConfigDef;
import org.apache.kafka.common.config.ConfigException;
import org.apache.kafka.connect.errors.ConnectException;
import org.apache.kafka.connect.connector.Task;
import org.apache.kafka.connect.source.SourceConnector;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static airqo.AirqoConnectorConfig.CONFIG_DEF;

public class AirqoConnector extends SourceConnector {

    private static final Logger logger = LoggerFactory.getLogger(AirqoConnector.class);

    private Map<String, String> configProperties;

    @Override
    public void start(Map<String, String> props) {

        logger.info("Starting up Airqo Source connector");

        try {
            configProperties = setupPropertiesWithDefaultsIfMissing(props);
        } catch (ConfigException e) {
            throw new ConnectException("Couldn't start Airqo Source Connector due to configuration error", e);
        }

    }

    private Map<String, String> setupPropertiesWithDefaultsIfMissing(Map<String, String> props) {

        return new AirqoConnectorConfig(props).propertiesWithDefaultsValuesIfMissing();

    }

    @Override
    public Class<? extends Task> taskClass() {
        return AirqoSourceTask.class;
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
        return CONFIG_DEF;
    }

    @Override
    public String version() {
        return VersionUtil.getVersion();
    }
}
