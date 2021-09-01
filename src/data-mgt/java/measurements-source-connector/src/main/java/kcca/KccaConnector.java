package kcca;

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

public class KccaConnector extends SourceConnector {

    private static final Logger logger = LoggerFactory.getLogger(KccaConnector.class);

    private Map<String, String> configProperties;

    @Override
    public void start(Map<String, String> props) {

        logger.info("Starting up Kcca Source connector");

        try {
            configProperties = setupPropertiesWithDefaultsIfMissing(props);
        } catch (ConfigException e) {
            throw new ConnectException("Couldn't start KccaSourceConnector due to configuration error", e);
        }

    }

    private Map<String, String> setupPropertiesWithDefaultsIfMissing(Map<String, String> props) {

        return new KccaConnectorConfig(props).propertiesWithDefaultsValuesIfMissing();

    }

    @Override
    public Class<? extends Task> taskClass() {
        return KccaSourceTask.class;
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
        return KccaConnectorConfig.CONFIG_DEF;
    }

    @Override
    public String version() {
        return VersionUtil.getVersion();
    }
}
