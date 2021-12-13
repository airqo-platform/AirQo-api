package airqo.utils;

import airqo.models.*;
import airqo.services.MeasurementService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.lang3.time.DateUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import static airqo.config.Constants.*;

@Profile({"measurements-job"})
@Component
public class MeasurementScheduledTasks {

	private static final Logger logger = LoggerFactory.getLogger(MeasurementScheduledTasks.class);
	private final HttpClient httpClient = HttpClient.newBuilder().build();
	@Autowired
	MeasurementService measurementService;
	@Autowired
	private ApplicationContext context;
	@Value("${airQoApi}")
	private String airQoBaseUrl;

	@PostConstruct
//	@Scheduled(cron = "${measurements.daily.cronSpec}")
	public void getMeasurements() {
		getDailyMeasurements();
		getHourlyMeasurements();
		int exitCode = SpringApplication.exit(context, () -> 0);
		System.exit(exitCode);
	}

	private void getHourlyMeasurements() {

		Date startTime = DateUtils.addHours(new Date(), -12);
		List<HourlyMeasurement> airQoMeasurements = (List<HourlyMeasurement>) getMeasurements(Tenant.AIRQO, startTime, Frequency.HOURLY);
		measurementService.insertMeasurements(new ArrayList<>(), airQoMeasurements, new ArrayList<>());

		List<HourlyMeasurement> kccaMeasurements = (List<HourlyMeasurement>) getMeasurements(Tenant.KCCA, startTime, Frequency.HOURLY);
		measurementService.insertMeasurements(new ArrayList<>(), kccaMeasurements, new ArrayList<>());
	}

	public void getDailyMeasurements() {

		Date startTime = DateUtils.addDays(new Date(), -2);
		List<DailyMeasurement> airQoMeasurements = (List<DailyMeasurement>) getMeasurements(Tenant.AIRQO, startTime, Frequency.DAILY);
		measurementService.insertMeasurements(new ArrayList<>(), new ArrayList<>(), airQoMeasurements);

		List<DailyMeasurement> kccaMeasurements = (List<DailyMeasurement>) getMeasurements(Tenant.KCCA, startTime, Frequency.DAILY);
		measurementService.insertMeasurements(new ArrayList<>(), new ArrayList<>(), kccaMeasurements);
	}

	private Object getMeasurements(Tenant tenant, Date startTime, Frequency frequency) {

		try {

			SimpleDateFormat dateFormat;

			switch (frequency) {
				case RAW:
					dateFormat = new SimpleDateFormat(longDateTimeFormat);
					break;
				case HOURLY:
					dateFormat = new SimpleDateFormat(dateTimeHourlyFormat);
					break;
				case DAILY:
					dateFormat = new SimpleDateFormat(dateTimeDailyFormat);
					break;
				default:
					dateFormat = new SimpleDateFormat(dateTimeFormat);
					break;
			}

			String url = airQoBaseUrl +
				"devices/events/?frequency=" + frequency + "&recent=no&external=no&tenant=" + tenant.toString() + "&startTime="
				+ dateFormat.format(startTime);

			logger.info(url);
			HttpRequest request = HttpRequest.newBuilder()
				.GET()
				.uri(URI.create(url))
				.setHeader("Accept", "application/json")
				.build();


			HttpResponse<String> httpResponse = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
			ObjectMapper objectMapper = new ObjectMapper();

			switch (frequency) {
				case RAW:
					RawMeasurement.MeasurementsList rawMeasurements = objectMapper.readValue(httpResponse.body(),
						RawMeasurement.MeasurementsList.class);

					return rawMeasurements.getMeasurements();
				case DAILY:
					DailyMeasurement.MeasurementsList dailyMeasurements = objectMapper.readValue(httpResponse.body(),
						DailyMeasurement.MeasurementsList.class);

					return dailyMeasurements.getMeasurements();
				case HOURLY:
					HourlyMeasurement.MeasurementsList hourlyMeasurements = objectMapper.readValue(httpResponse.body(),
						HourlyMeasurement.MeasurementsList.class);
					return hourlyMeasurements.getMeasurements();
				default:
					return new ArrayList<>();
			}


		} catch (Exception e) {
			e.printStackTrace();
		}

		return new ArrayList<>();
	}

}
