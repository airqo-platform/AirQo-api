package airqo.tasks;

import airqo.models.Event;
import airqo.services.EventService;
import org.apache.commons.lang3.time.DateUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.text.SimpleDateFormat;
import java.util.Date;

@Profile({"staging", "production"})
@Component
public class EventScheduledTasks {

	private static final Logger logger = LoggerFactory.getLogger(EventScheduledTasks.class);

	private static final SimpleDateFormat dateFormat = new SimpleDateFormat("yyy-MM-dd'T'HH:00:00'Z'");

	@Autowired
	EventService eventService;

	@Value("${airqo.api}")
	private String airqoBaseUrl;


	@Scheduled(cron = "${airqo.events.raw.cronSpec}")
	public void getRowEvents() {

		RestTemplate restTemplate = new RestTemplate();

		try {
			// AirQo
			Event.EventList airqoRowEvents = restTemplate.getForObject(
				String.format("%s/devices/events?tenant=airqo&frequency=raw&tenant=airqo&startTime=%s",
					airqoBaseUrl, dateFormat.format(DateUtils.addHours(new Date(), -1))),
				Event.EventList.class);

			if (airqoRowEvents != null) {
				logger.info(airqoRowEvents.toString());
				eventService.insertEvents(airqoRowEvents.getEvents());
			}
		} catch (RestClientException e) {
			e.printStackTrace();
		}

		try {
			// Kcca
			Event.EventList kccaRowEvents = restTemplate.getForObject(
				String.format("%s/devices/events?tenant=airqo&frequency=raw&tenant=kcca&startTime=%s",
					airqoBaseUrl, dateFormat.format(DateUtils.addHours(new Date(), -1))),
				Event.EventList.class);
			if (kccaRowEvents != null) {
				logger.info(kccaRowEvents.toString());
				eventService.insertEvents(kccaRowEvents.getEvents());
			}
		} catch (RestClientException e) {
			e.printStackTrace();
		}

	}

	@Scheduled(cron = "${airqo.events.hourly.cronSpec}")
	public void getHourlyEvents() {

		RestTemplate restTemplate = new RestTemplate();

		try {
			// AirQo
			Event.EventList airqoHourlyEvents = restTemplate.getForObject(
				String.format("%s/devices/events?tenant=airqo&frequency=hourly&tenant=airqo&startTime=%s",
					airqoBaseUrl, dateFormat.format(DateUtils.addHours(new Date(), -1))),
				Event.EventList.class);
			if (airqoHourlyEvents != null) {
				logger.info(airqoHourlyEvents.toString());
				eventService.insertEvents(airqoHourlyEvents.getEvents());
			}
		} catch (RestClientException e) {
			e.printStackTrace();
		}

		try {
			// Kcca
			Event.EventList kccaHourlyEvents = restTemplate.getForObject(
				String.format("%s/devices/events?tenant=airqo&frequency=hourly&tenant=kcca&startTime=%s",
					airqoBaseUrl, dateFormat.format(DateUtils.addHours(new Date(), -1))),
				Event.EventList.class);
			if (kccaHourlyEvents != null) {
				logger.info(kccaHourlyEvents.toString());
				eventService.insertEvents(kccaHourlyEvents.getEvents());
			}
		} catch (RestClientException e) {
			e.printStackTrace();
		}

	}

	@Scheduled(cron = "${airqo.events.daily.cronSpec}")
	public void getDailyEvents() {

		RestTemplate restTemplate = new RestTemplate();

		try {
			// AirQo
			Event.EventList airqoDailyEvents = restTemplate.getForObject(
				String.format("%s/devices/events?tenant=airqo&frequency=daily&tenant=kcca&startTime=%s",
					airqoBaseUrl, dateFormat.format(DateUtils.addHours(new Date(), -24))),
				Event.EventList.class);

			if (airqoDailyEvents != null) {
				logger.info(airqoDailyEvents.toString());
				eventService.insertEvents(airqoDailyEvents.getEvents());
			}
		} catch (RestClientException e) {
			e.printStackTrace();
		}

		try {
			// Kcca
			Event.EventList kccaDailyEvents = restTemplate.getForObject(
				String.format("%s/devices/events?tenant=airqo&frequency=daily&tenant=kcca&startTime=%s",
					airqoBaseUrl, dateFormat.format(DateUtils.addHours(new Date(), -24))),
				Event.EventList.class);

			if (kccaDailyEvents != null) {
				logger.info(kccaDailyEvents.toString());
				eventService.insertEvents(kccaDailyEvents.getEvents());
			}
		} catch (RestClientException e) {
			e.printStackTrace();
		}


	}
}
