package airqo.controllers;

import airqo.models.Measurement;
import airqo.models.Message;
import airqo.services.InsightsService;
import com.fasterxml.jackson.core.json.JsonReadFeature;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.sentry.Sentry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Profile({"messageBroker"})
@Component
public class MessageBroker {
	private final ObjectMapper objectMapper;

	@Autowired
	InsightsService insightsService;

	@Autowired
	public MessageBroker(ObjectMapper objectMapper) {
		this.objectMapper = objectMapper;
		this.objectMapper.enable(JsonReadFeature.ALLOW_NON_NUMERIC_NUMBERS.mappedFeature());
	}

	@KafkaListener(topics = "#{'${spring.kafka.consumer.topics.hourly-measurements}'.split(',')}")
	public void latestMeasurements(String content) {
		try {
			Message<Measurement> dataMessage = objectMapper.readValue(content, new TypeReference<>() {
			});
			List<String> siteIds = new java.util.ArrayList<>(dataMessage.getData().stream().map(Measurement::getSiteId).toList());
			siteIds.removeIf(s -> s == null || s.isEmpty() || s.equalsIgnoreCase("nan"));

			log.info(String.format("Received sites : %s", siteIds));

			insightsService.updateInsightsCache(siteIds);

		} catch (Exception e) {
			Sentry.captureException(e);
			e.printStackTrace();
		}
	}
}
