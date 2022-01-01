package airqo.controllers;

import airqo.models.Device;
import airqo.models.Site;
import airqo.models.Weather;
import airqo.services.DeviceService;
import airqo.services.MeasurementService;
import airqo.services.SiteService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Profile({"messageBroker"})
@Component
public class MessageBroker {

	final Logger logger = LoggerFactory.getLogger(getClass());

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

	@KafkaListener(topics = "#{'${spring.kafka.consumer.topics.weather}'.split(',')}")
	public void receiveWeatherData(String content) {
		try {

			ObjectMapper objectMapper = new ObjectMapper();

			List<Weather> weatherList = objectMapper.readValue(content, new TypeReference<>() {
			});
			List<Site> sites = siteService.getSites(null);

			for (Weather weather : weatherList) {
				try {
					List<Site> weatherSite = sites.stream().filter(site ->
						Objects.equals(site.getId(), weather.getSite().getId())).collect(Collectors.toList());
					if (weatherSite.isEmpty()) {
						continue;
					}
					weather.setSite(weatherSite.get(0));
					measurementService.insertWeather(weather);
				} catch (Exception e) {
					e.printStackTrace();
				}
			}

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
}
