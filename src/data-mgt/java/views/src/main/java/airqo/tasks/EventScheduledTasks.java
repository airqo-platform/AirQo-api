package airqo.tasks;

import airqo.models.Event;
import airqo.services.EventService;
import org.apache.commons.lang3.time.DateUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.client.RestTemplate;

import java.text.SimpleDateFormat;
import java.util.Date;

//@Component
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

		// AirQo
		Event.EventList airqoRowEvents = restTemplate.getForObject(
			String.format("%s/devices/events?tenant=airqo&frequency=raw&tenant=airqo&startTime=%s",
				airqoBaseUrl, dateFormat.format(DateUtils.addHours(new Date(), -1))),
			Event.EventList.class);
		assert airqoRowEvents != null;
		logger.info(airqoRowEvents.toString());
		eventService.insertEvents(airqoRowEvents.getEvents());


		// Kcca
		Event.EventList kccaRowEvents = restTemplate.getForObject(
			String.format("%s/devices/events?tenant=airqo&frequency=raw&tenant=kcca&startTime=%s",
				airqoBaseUrl, dateFormat.format(DateUtils.addHours(new Date(), -1))),
			Event.EventList.class);
		assert kccaRowEvents != null;
		logger.info(kccaRowEvents.toString());
		eventService.insertEvents(kccaRowEvents.getEvents());
	}

	@Scheduled(cron = "${airqo.events.hourly.cronSpec}")
	public void getHourlyEvents() {

		RestTemplate restTemplate = new RestTemplate();

		// AirQo
		Event.EventList airqoHourlyEvents = restTemplate.getForObject(
			String.format("%s/devices/events?tenant=airqo&frequency=hourly&tenant=airqo&startTime=%s",
				airqoBaseUrl, dateFormat.format(DateUtils.addHours(new Date(), -1))),
			Event.EventList.class);
		assert airqoHourlyEvents != null;
		logger.info(airqoHourlyEvents.toString());
		eventService.insertEvents(airqoHourlyEvents.getEvents());


		// Kcca
		Event.EventList kccaHourlyEvents = restTemplate.getForObject(
			String.format("%s/devices/events?tenant=airqo&frequency=hourly&tenant=kcca&startTime=%s",
				airqoBaseUrl, dateFormat.format(DateUtils.addHours(new Date(), -1))),
			Event.EventList.class);
		assert kccaHourlyEvents != null;
		logger.info(kccaHourlyEvents.toString());
		eventService.insertEvents(kccaHourlyEvents.getEvents());
	}

	@Scheduled(cron = "${airqo.events.daily.cronSpec}")
	public void getDailyEvents() {

		RestTemplate restTemplate = new RestTemplate();

		// AirQo
		Event.EventList airqoDailyEvents = restTemplate.getForObject(
			String.format("%s/devices/events?tenant=airqo&frequency=daily&tenant=kcca&startTime=%s",
				airqoBaseUrl, dateFormat.format(DateUtils.addHours(new Date(), -24))),
			Event.EventList.class);
		assert airqoDailyEvents != null;
		logger.info(airqoDailyEvents.toString());
		eventService.insertEvents(airqoDailyEvents.getEvents());

		// Kcca
		Event.EventList kccaDailyEvents = restTemplate.getForObject(
			String.format("%s/devices/events?tenant=airqo&frequency=daily&tenant=kcca&startTime=%s",
				airqoBaseUrl, dateFormat.format(DateUtils.addHours(new Date(), -24))),
			Event.EventList.class);
		assert kccaDailyEvents != null;
		logger.info(kccaDailyEvents.toString());
		eventService.insertEvents(kccaDailyEvents.getEvents());

	}
}
