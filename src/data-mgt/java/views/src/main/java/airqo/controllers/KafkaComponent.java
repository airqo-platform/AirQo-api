package airqo.controllers;

import airqo.models.Device;
import airqo.models.RawMeasurement;
import airqo.models.Site;
import airqo.services.DeviceService;
import airqo.services.MeasurementService;
import airqo.services.SiteService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Profile({"excluded"})
@Component
public class KafkaComponent {

	Logger logger = LoggerFactory.getLogger(getClass());

	@Autowired
	MeasurementService measurementService;

	@Autowired
	SiteService siteService;

	@Autowired
	DeviceService deviceService;

	@KafkaListener(topics = "#{'${spring.kafka.consumer.topics.sites}'.split(',')}")
	public void receiveSites(String content) {
		try {

			ObjectMapper objectMapper = new ObjectMapper();
			Site.SiteList siteList = objectMapper.readValue(content, Site.SiteList.class);
			siteService.insertSites(siteList.getSites(), null);
			logger.info(siteList.toString());

		} catch (JsonProcessingException e) {
			e.printStackTrace();
		}
	}

	@KafkaListener(topics = "#{'${spring.kafka.consumer.topics.devices}'.split(',')}")
	public void receiveDevices(String content) {
		try {

			ObjectMapper objectMapper = new ObjectMapper();
			Device.DeviceList deviceList = objectMapper.readValue(content, Device.DeviceList.class);
			deviceService.insertDevices(deviceList.getDevices(), null);
			logger.info(deviceList.toString());

		} catch (JsonProcessingException e) {
			e.printStackTrace();
		}
	}

	@KafkaListener(topics = "#{'${spring.kafka.consumer.topics.rawMeasurements}'.split(',')}")
	public void receiveRawMeasurements(String content) {
		try {

			ObjectMapper objectMapper = new ObjectMapper();
			List<RawMeasurement> measurementsList = new ArrayList<>();
			measurementService.insertMeasurements(measurementsList, new ArrayList<>());
			logger.info(measurementsList.toString());

		} catch (Exception e) {
			e.printStackTrace();
		}
	}
}
