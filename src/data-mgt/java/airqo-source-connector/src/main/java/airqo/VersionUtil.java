package airqo;

import java.util.Properties;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class VersionUtil {

    private static final Logger logger = LoggerFactory.getLogger(VersionUtil.class);
    public static String getVersion() {
        final Properties properties = new Properties();
        try {
            properties.load(VersionUtil.class.getClassLoader().getResourceAsStream("application.properties"));
            logger.info("\nApplication version has been loaded {}\n", properties);
        } catch (Exception e) {
            logger.error("Unable to load Project version from application.properties.", e);
        }
        return properties.getProperty("project.version","0.0.1");

    }
}
