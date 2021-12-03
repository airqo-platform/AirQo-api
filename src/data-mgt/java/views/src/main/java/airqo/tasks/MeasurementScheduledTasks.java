package airqo.tasks;

import airqo.models.Measurement;
import airqo.services.MeasurementService;
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
public class MeasurementScheduledTasks {

	private static final Logger logger = LoggerFactory.getLogger(MeasurementScheduledTasks.class);

	private static final SimpleDateFormat dateFormat = new SimpleDateFormat("yyy-MM-dd'T'HH:00:00'Z'");

	@Autowired
	MeasurementService measurementService;

	@Value("${airqo.api}")
	private String airqoBaseUrl;


//	@Scheduled(cron = "${airqo.measurements.raw.cronSpec}")
//	public void getRowMeasurements() {
//
//		RestTemplate restTemplate = new RestTemplate();
//
//		try {
//			// AirQo
//			Measurement.MeasurementsList airqoRowMeasurements = restTemplate.getForObject(
//				String.format("%s/devices/events?tenant=airqo&frequency=raw&tenant=airqo&startTime=%s",
//					airqoBaseUrl, dateFormat.format(DateUtils.addHours(new Date(), -1))),
//				Measurement.MeasurementsList.class);
//
//			if (airqoRowMeasurements != null) {
//				logger.info(airqoRowMeasurements.toString());
//				measurementService.insertMeasurements(airqoRowMeasurements.getMeasurements());
//			}
//		} catch (RestClientException e) {
//			e.printStackTrace();
//		}
//
//		try {
//			// Kcca
//			Measurement.MeasurementsList kccaRowMeasurements = restTemplate.getForObject(
//				String.format("%s/devices/events?tenant=airqo&frequency=raw&tenant=kcca&startTime=%s",
//					airqoBaseUrl, dateFormat.format(DateUtils.addHours(new Date(), -1))),
//				Measurement.MeasurementsList.class);
//			if (kccaRowMeasurements != null) {
//				logger.info(kccaRowMeasurements.toString());
//				measurementService.insertMeasurements(kccaRowMeasurements.getMeasurements());
//			}
//		} catch (RestClientException e) {
//			e.printStackTrace();
//		}
//
//	}
//
//	@Scheduled(cron = "${airqo.measurements.hourly.cronSpec}")
//	public void getHourlyMeasurements() {
//
//		RestTemplate restTemplate = new RestTemplate();
//
//		try {
//			// AirQo
//			Measurement.MeasurementsList airqoHourlyMeasurements = restTemplate.getForObject(
//				String.format("%s/devices/events?tenant=airqo&frequency=hourly&tenant=airqo&startTime=%s",
//					airqoBaseUrl, dateFormat.format(DateUtils.addHours(new Date(), -1))),
//				Measurement.MeasurementsList.class);
//			if (airqoHourlyMeasurements != null) {
//				logger.info(airqoHourlyMeasurements.toString());
//				measurementService.insertMeasurements(airqoHourlyMeasurements.getMeasurements());
//			}
//		} catch (RestClientException e) {
//			e.printStackTrace();
//		}
//
//		try {
//			// Kcca
//			Measurement.MeasurementsList kccaHourlyMeasurements = restTemplate.getForObject(
//				String.format("%s/devices/events?tenant=airqo&frequency=hourly&tenant=kcca&startTime=%s",
//					airqoBaseUrl, dateFormat.format(DateUtils.addHours(new Date(), -1))),
//				Measurement.MeasurementsList.class);
//			if (kccaHourlyMeasurements != null) {
//				logger.info(kccaHourlyMeasurements.toString());
//				measurementService.insertMeasurements(kccaHourlyMeasurements.getMeasurements());
//			}
//		} catch (RestClientException e) {
//			e.printStackTrace();
//		}
//
//	}
//
//	@Scheduled(cron = "${airqo.measurements.daily.cronSpec}")
//	public void getDailyMeasurements() {
//
//		RestTemplate restTemplate = new RestTemplate();
//
//		try {
//			// AirQo
//			Measurement.MeasurementsList airqoDailyMeasurements = restTemplate.getForObject(
//				String.format("%s/devices/events?tenant=airqo&frequency=daily&tenant=kcca&startTime=%s",
//					airqoBaseUrl, dateFormat.format(DateUtils.addHours(new Date(), -24))),
//				Measurement.MeasurementsList.class);
//
//			if (airqoDailyMeasurements != null) {
//				logger.info(airqoDailyMeasurements.toString());
//				measurementService.insertMeasurements(airqoDailyMeasurements.getMeasurements());
//			}
//		} catch (RestClientException e) {
//			e.printStackTrace();
//		}
//
//		try {
//			// Kcca
//			Measurement.MeasurementsList kccaDailyMeasurements = restTemplate.getForObject(
//				String.format("%s/devices/events?tenant=airqo&frequency=daily&tenant=kcca&startTime=%s",
//					airqoBaseUrl, dateFormat.format(DateUtils.addHours(new Date(), -24))),
//				Measurement.MeasurementsList.class);
//
//			if (kccaDailyMeasurements != null) {
//				logger.info(kccaDailyMeasurements.toString());
//				measurementService.insertMeasurements(kccaDailyMeasurements.getMeasurements());
//			}
//		} catch (RestClientException e) {
//			e.printStackTrace();
//		}
//
//
//	}
}
