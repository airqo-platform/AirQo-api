package airqo.config;

import org.springframework.boot.autoconfigure.cache.RedisCacheManagerBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;

import java.time.Duration;

@Profile({"api"})
@Configuration
public class CacheConfig {

	@Bean
	public RedisCacheManagerBuilderCustomizer redisCacheManagerBuilderCustomizer() {
		return (builder) -> builder
			.withCacheConfiguration("viewSitesCache",
				RedisCacheConfiguration.defaultCacheConfig().entryTtl(Duration.ofMinutes(5)))
			.withCacheConfiguration("insightsCache",
				RedisCacheConfiguration.defaultCacheConfig().entryTtl(Duration.ofMinutes(5)))
			.withCacheConfiguration("apiInsightsCache",
				RedisCacheConfiguration.defaultCacheConfig().entryTtl(Duration.ofMinutes(5)))
			.withCacheConfiguration("viewDevicesCache",
				RedisCacheConfiguration.defaultCacheConfig().entryTtl(Duration.ofSeconds(5)));
	}

	@Bean
	public RedisCacheConfiguration cacheConfiguration() {
		return RedisCacheConfiguration.defaultCacheConfig()
			.entryTtl(Duration.ofMinutes(5))
			.disableCachingNullValues()
			.serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(new GenericJackson2JsonRedisSerializer()));
	}

}
