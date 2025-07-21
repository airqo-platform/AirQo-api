package airqo.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.AutoConfigureAfter;
import org.springframework.boot.autoconfigure.cache.RedisCacheManagerBuilderCustomizer;
import org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.cache.RedisCacheConfiguration;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@Profile({"api"})
@Configuration
@AutoConfigureAfter(RedisAutoConfiguration.class)
public class CacheConfig {

	@Value("${app-insights-api-cache}")
	private int appInsightsApiCache;

	@Value("${bigQuery-insights-cache}")
	private int bigQueryInsightsCache;

	@Bean
	RedisCacheManagerBuilderCustomizer redisCacheManagerBuilderCustomizer() {
		return (builder) -> {
			Map<String, RedisCacheConfiguration> configurationMap = new HashMap<>();
			configurationMap.put("appInsightsCacheV2", RedisCacheConfiguration.defaultCacheConfig().entryTtl(Duration.ofMinutes(5)));
			configurationMap.put("bigQueryInsightsCache", RedisCacheConfiguration.defaultCacheConfig().entryTtl(Duration.ofMinutes(bigQueryInsightsCache)));
			configurationMap.put("appInsightsApiCache", RedisCacheConfiguration.defaultCacheConfig().entryTtl(Duration.ofMinutes(appInsightsApiCache)));
			builder.withInitialCacheConfigurations(configurationMap);
		};
	}
}
