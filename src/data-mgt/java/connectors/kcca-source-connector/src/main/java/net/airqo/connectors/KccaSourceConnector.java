package net.airqo.connectors;

import net.airqo.connectors.config.KccaSourceConnectorConfig;
import net.airqo.connectors.tasks.KccaSourceTask;
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

import static net.airqo.connectors.config.KccaSourceConnectorConfig.CONFIG_DEF;

public class KccaSourceConnector extends SourceConnector {

    private static Logger log = LoggerFactory.getLogger(KccaSourceConnector.class);

    private Map<String, String> configProperties;

    @Override
    public void start(Map<String, String> props) {

        log.info("Starting up Kcca Source connector");

        try {
            configProperties = setupPropertiesWithDefaultsIfMissing(props);
        } catch (ConfigException e) {
            throw new ConnectException("Couldn't start KccaSourceConnector due to configuration error", e);
        }

    }

    private Map<String, String> setupPropertiesWithDefaultsIfMissing(Map<String, String> props) {

        return new KccaSourceConnectorConfig(props).propertiesWithDefaultsValuesIfMissing();

    }

    @Override
    public Class<? extends Task> taskClass() {
        return KccaSourceTask.class;
    }

    @Override
    public List<Map<String, String>> taskConfigs(int maxTasks) {

        ArrayList<Map<String, String>> configs = new ArrayList<Map<String, String>>(maxTasks);

        Map<String, String> config = new HashMap<String, String>();
        config.putAll(configProperties);

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
