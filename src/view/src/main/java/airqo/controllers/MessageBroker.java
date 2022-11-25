package airqo.controllers;

import airqo.models.Insight;
import airqo.models.Message;
import airqo.services.MeasurementService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.sentry.Sentry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.TopicPartition;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Profile({"messageBroker"})
@Component
public class MessageBroker {

	private final MeasurementService measurementService;
	private final ObjectMapper objectMapper;

	@Autowired
	public MessageBroker(MeasurementService measurementService, ObjectMapper objectMapper) {
		this.measurementService = measurementService;
		this.objectMapper = objectMapper;
	}

	@KafkaListener(topics = "#{'${spring.kafka.consumer.topics.insights}'.split(',')}",
		clientIdPrefix = "insights-partition-0",
		topicPartitions = @TopicPartition(
			topic = "#{'${spring.kafka.consumer.topics.insights}'}", partitions = {"0"}))
	public void appInsights(String content) {
		log.info("\n");
		log.info("Partition 0");
		processAppInsights(content);
	}

	@KafkaListener(topics = "#{'${spring.kafka.consumer.topics.insights}'.split(',')}",
		clientIdPrefix = "insights-partition-1",
		topicPartitions = @TopicPartition(
			topic = "#{'${spring.kafka.consumer.topics.insights}'}", partitions = {"1"}))
	public void appForecastInsights(String content) {
		log.info("\n");
		log.info("Partition 1");
		processAppInsights(content);
	}

	@KafkaListener(topics = "#{'${spring.kafka.consumer.topics.insights}'.split(',')}",
		clientIdPrefix = "insights-partition-2",
		topicPartitions = @TopicPartition(
			topic = "#{'${spring.kafka.consumer.topics.insights}'}", partitions = {"2"}))
	public void appPlaceHolderInsights(String content) {
		log.info("\n");
		log.info("Partition 2");
		processAppInsights(content);
	}

	private void processAppInsights(String content) {
		try {

			Message<Insight> dataMessage = objectMapper.readValue(content, new TypeReference<>() {
			});
			log.info(String.format("Received Insights : %s", dataMessage.getData().size()));

			List<Insight> data = dataMessage.getData();
			List<Insight> insights = data.stream().map(Insight::setId).collect(Collectors.toList());
			List<Insight> emptyInsights = insights.stream().filter(Insight::getEmpty).collect(Collectors.toList());
			List<Insight> availableInsights = insights.stream().filter(insight -> !insight.getEmpty()).collect(Collectors.toList());

			log.info(String.format("Empty Insights : %s", emptyInsights.size()));
			log.info(String.format("Available Insights : %s", availableInsights.size()));

			measurementService.insertInsights(emptyInsights);
			measurementService.saveInsights(availableInsights);

		} catch (JsonProcessingException e) {
			Sentry.captureException(e);
			e.printStackTrace();
		}
	}
}
