package airqo.controllers;

import airqo.models.Device;
import airqo.models.Event;
import airqo.models.Site;
import airqo.services.DeviceService;
import airqo.services.EventService;
import airqo.services.SiteService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.annotation.KafkaListener;

//@Component
public class KafkaComponent {

	Logger logger = LoggerFactory.getLogger(getClass());

	@Autowired
	EventService eventService;

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

	@KafkaListener(topics = "#{'${spring.kafka.consumer.topics.events}'.split(',')}")
	public void receiveEvents(String content) {
		try {

			ObjectMapper objectMapper = new ObjectMapper();
			Event.EventList eventList = objectMapper.readValue(content, Event.EventList.class);
			eventService.insertEvents(eventList.getEvents());
			logger.info(eventList.toString());

		} catch (JsonProcessingException e) {
			e.printStackTrace();
		}
	}
}
