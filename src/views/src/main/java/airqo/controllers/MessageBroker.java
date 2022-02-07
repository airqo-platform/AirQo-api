package airqo.controllers;

import airqo.models.*;
import airqo.services.DeviceService;
import airqo.services.MeasurementService;
import airqo.services.SiteService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.sentry.Sentry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

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

			ObjectMapper objectMapper = new ObjectMapper();
			Site.SiteList siteList = objectMapper.readValue(content, Site.SiteList.class);
			siteService.insertSites(siteList.getSites(), null);
			log.info(siteList.toString());

		} catch (JsonProcessingException e) {
			e.printStackTrace();
		}
	}


	@KafkaListener(topics = "#{'${spring.kafka.consumer.topics.insights}'.split(',')}")
	public void appInsights(String content) {
		try {

			Insight.InsightMessage insightMessage = objectMapper.readValue(content, Insight.InsightMessage.class);

			List<Insight> insights = insightMessage.getData();

			List<Insight> insightsList = new ArrayList<>();
			for (Insight insight : insights) {
				insight.setId();
				insightsList.add(insight);
			}

			log.info(insightMessage.toString());
			if (insightMessage.getAction().equalsIgnoreCase("save")) {
				measurementService.saveInsights(insightsList);
			} else if (insightMessage.getAction().equalsIgnoreCase("delete")) {
				measurementService.deleteInsightsBefore(insightMessage.getStartTime());
			} else {
				measurementService.insertInsights(insightsList);
			}

		} catch (JsonProcessingException e) {
			Sentry.captureException(e);
			e.printStackTrace();
		}
	}

	@KafkaListener(topics = "#{'${spring.kafka.consumer.topics.hourly-measurements}'.split(',')}")
	public void hourlyMeasurements(String content) {
		try {

			HourlyMeasurement.HourlyMeasurementMessage dataMessage = objectMapper.readValue(content, HourlyMeasurement.HourlyMeasurementMessage.class);

			List<Measurement.BrokerMeasurement> data = dataMessage.getData();

			List<Insight> insightsList = new ArrayList<>();
			for (Measurement.BrokerMeasurement measurement : data) {
				if (measurement.getTenant().equalsIgnoreCase("airqo")) {
					Insight hourlyInsight = new Insight("", measurement.getTime(), measurement.getPm2_5(), measurement.getPm10(), false, false, "HOURLY", measurement.getSite_id());
					hourlyInsight.setId();
					insightsList.add(hourlyInsight);
				}
			}
			log.info(dataMessage.toString());
			measurementService.saveInsights(insightsList);

		} catch (JsonProcessingException e) {
			Sentry.captureException(e);
			e.printStackTrace();

		}
	}

	//	@KafkaListener(topics = "#{'${spring.kafka.consumer.topics.devices}'.split(',')}")
	public void devices(String content) {
		try {
			ObjectMapper objectMapper = new ObjectMapper();
			Device.DeviceList deviceList = objectMapper.readValue(content, Device.DeviceList.class);
			deviceService.insertDevices(deviceList.getDevices(), null);
			log.info(deviceList.toString());

		} catch (JsonProcessingException e) {
			e.printStackTrace();
		}
	}
}
