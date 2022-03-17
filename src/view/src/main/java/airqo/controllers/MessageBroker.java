package airqo.controllers;

import airqo.models.*;
import airqo.services.DeviceService;
import airqo.services.MeasurementService;
import airqo.services.SiteService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.sentry.Sentry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Slf4j
@Profile({"messageBroker"})
@Component
public class MessageBroker {

	private final MeasurementService measurementService;
	private final SiteService siteService;
	private final DeviceService deviceService;
	private final ObjectMapper objectMapper;

	@Autowired
	public MessageBroker(MeasurementService measurementService, SiteService siteService, DeviceService deviceService, ObjectMapper objectMapper) {
		this.measurementService = measurementService;
		this.siteService = siteService;
		this.deviceService = deviceService;
		this.objectMapper = objectMapper;
	}

//	@KafkaListener(topics = "#{'${spring.kafka.consumer.topics.sites}'.split(',')}")
	public void sites(String content) {
		try {
			Message<Site> dataMessage = objectMapper.readValue(content, new TypeReference<>() {
			});
			List<Site> data = dataMessage.getData();
			siteService.saveSites(data);

		} catch (JsonProcessingException e) {
			e.printStackTrace();
		}
	}

	@KafkaListener(topics = "#{'${spring.kafka.consumer.topics.insights}'.split(',')}")
	public void appInsights(String content) {
		try {

			Message<Insight> dataMessage = objectMapper.readValue(content, new TypeReference<>() {
			});
			log.info(dataMessage.toString());
			List<Insight> insights = dataMessage.getData();

			List<Insight> insightsList = new ArrayList<>();
			for (Insight insight : insights) {
				insight.setId();
				insightsList.add(insight);
			}

			if (dataMessage.getAction() == null || dataMessage.getAction().equals(MessageAction.SAVE)) {
				measurementService.saveInsights(insightsList);
			} else {
				measurementService.insertInsights(insightsList);
			}

			log.info("{}", insightsList);

		} catch (JsonProcessingException e) {
			Sentry.captureException(e);
			e.printStackTrace();
		}
	}

//	@KafkaListener(topics = "#{'${spring.kafka.consumer.topics.hourly-measurements}'.split(',')}")
	public void measurements(String content) {
		try {

			Message<Measurement> dataMessage = objectMapper.readValue(content, new TypeReference<>() {
			});
			List<Measurement> data = dataMessage.getData();
			measurementService.saveMeasurements(data);

		} catch (JsonProcessingException e) {
			Sentry.captureException(e);
			e.printStackTrace();

		}
	}

//	@KafkaListener(topics = "#{'${spring.kafka.consumer.topics.devices}'.split(',')}")
	public void devices(String content) {
		try {
			Message<Device> dataMessage = objectMapper.readValue(content, new TypeReference<>() {
			});
			List<Site> sites = siteService.getSites(null);

			List<Device> devices = dataMessage.getData();
			for (Device device : devices) {
				try {
					Site site = sites.stream().filter(s -> {
						List<Device> siteDevices = new ArrayList<>(s.getDevices());
						return siteDevices.stream().anyMatch(device1 -> Objects.equals(device1.getId(), device.getId()));
					}).collect(Collectors.toList()).get(0);
					device.setSite(site);
				} catch (Exception e) {
					e.printStackTrace();
				}
			}
			deviceService.saveDevices(devices);

		} catch (JsonProcessingException e) {
			e.printStackTrace();
		}
	}
}
