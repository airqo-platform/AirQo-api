package airqo.controllers;

import airqo.models.Insight;
import airqo.models.Site;
import airqo.models.Weather;
import airqo.services.DeviceService;
import airqo.services.MeasurementService;
import airqo.services.SiteService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
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
//	public void sites(String content) {
//		try {
//
//			ObjectMapper objectMapper = new ObjectMapper();
//			Site.SiteList siteList = objectMapper.readValue(content, Site.SiteList.class);
//			siteService.insertSites(siteList.getSites(), null);
//			logger.info(siteList.toString());
//
//		} catch (JsonProcessingException e) {
//			e.printStackTrace();
//		}
//	}
//
	@KafkaListener(topics = "#{'${spring.kafka.consumer.topics.weather}'.split(',')}")
	public void weatherData(String content) {
		try {

			ObjectMapper objectMapper = new ObjectMapper();

			Weather.WeatherMessage weatherMessage = objectMapper.readValue(content, Weather.WeatherMessage.class);

			List<Weather> weatherList = weatherMessage.getData();

			List<Site> sites = siteService.getSites(null);
			List<Weather> weatherData = new ArrayList<>();
			for (Weather weather : weatherList) {
				try {
					List<Site> weatherSite = sites.stream().filter(site ->
						Objects.equals(site.getId(), weather.getSite().getId())).collect(Collectors.toList());
					if (weatherSite.isEmpty()) {
						continue;
					}
					weather.setSite(weatherSite.get(0));
					weatherData.add(weather);

				} catch (Exception e) {
					e.printStackTrace();
				}
			}

			if (weatherMessage.getAction().equalsIgnoreCase("save")) {
				measurementService.saveWeather(weatherData);
			} else {
				measurementService.insertWeather(weatherData);
			}

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

			log.info(insightsList.toString());

		} catch (JsonProcessingException e) {
			e.printStackTrace();
		}
	}

//	@KafkaListener(topics = "#{'${spring.kafka.consumer.topics.devices}'.split(',')}")
//	public void devices(String content) {
//		try {
//			ObjectMapper objectMapper = new ObjectMapper();
//			Device.DeviceList deviceList = objectMapper.readValue(content, Device.DeviceList.class);
//			deviceService.insertDevices(deviceList.getDevices(), null);
//			logger.info(deviceList.toString());
//
//		} catch (JsonProcessingException e) {
//			e.printStackTrace();
//		}
//	}
}
