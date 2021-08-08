package airqo;


import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Properties;

import static airqo.Utils.loadEnvProperties;

public class UtilsTest {


    private static final Logger logger = LoggerFactory.getLogger(UtilsTest.class);

    static Properties properties = new Properties();

    @AfterAll
    static void tearDown() {
        logger.info("Utils tests ended");
    }

    @BeforeAll
    static void setup() {
        logger.info("Utils tests started");
        properties = loadEnvProperties("application.properties");
    }

}