package airqo.utils;

import airqo.models.*;
import airqo.services.DeviceService;
import airqo.services.MeasurementService;
import airqo.services.SiteService;
import org.apache.commons.lang3.time.DateUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import static airqo.config.Constants.dateTimeDailyFormat;
import static airqo.config.Constants.dateTimeHourlyFormat;


@Profile({"insights-job", "jobs"})
@Component
public class InsightsScheduledTasks {

	private static final Logger logger = LoggerFactory.getLogger(InsightsScheduledTasks.class);
	final SimpleDateFormat hourlyDateFormat = new SimpleDateFormat(dateTimeHourlyFormat);
	final SimpleDateFormat dailyDateFormat = new SimpleDateFormat(dateTimeDailyFormat);
	private final int timeBoundary = 21;
	@Autowired
	MeasurementService measurementService;
	@Autowired
	SiteService siteService;
	@Autowired
	DeviceService deviceService;
	@Autowired
	private ApplicationContext context;

	@PostConstruct
	public void createInsights() {

		saveHourlyInsights();
		saveDailyInsights();
		formatInsights();

		int exitCode = SpringApplication.exit(context, () -> 0);
		System.exit(exitCode);
	}

	private void formatInsights() {

		logger.info("Deleting measurements .......");
		Date startTime = DateUtils.addDays(new Date(), -(timeBoundary + 1));
		Date endTime = DateUtils.addDays(new Date(), (timeBoundary + 1));

		measurementService.deleteInsights(startTime, endTime);

		logger.info("Formatting forecast measurements .......");
		List<Insight> insights = measurementService.getInsights(new Date());
		List<Insight> formattedInsights = new ArrayList<>();
		for (Insight insight : insights) {
			insight.setIsForecast(false);
			formattedInsights.add(insight);
		}

		measurementService.insertInsights(formattedInsights);
	}

	private Date formatTime(Date time, Frequency frequency) {
		try {
			if (frequency == Frequency.HOURLY) {
				return hourlyDateFormat.parse(hourlyDateFormat.format(time));
			} else if (frequency == Frequency.DAILY) {
				return hourlyDateFormat.parse(dailyDateFormat.format(time));
			} else {
				return hourlyDateFormat.parse(hourlyDateFormat.format(time));
			}

		} catch (ParseException e) {
			e.printStackTrace();
		}
		return time;
	}

	private void saveHourlyInsights() {
		Date startTime = DateUtils.addHours(new Date(), -4);

		// hourly insights
		logger.info("Getting hourly measurements .......");
		List<Insight> insights = new ArrayList<>();
		List<HourlyMeasurement> devicesHourlyMeasurements = measurementService
			.getHourlyMeasurements(null, startTime, Tenant.AIRQO);
		for (HourlyMeasurement hourlyMeasurement : devicesHourlyMeasurements) {
			Insight insight = new Insight(
				formatTime(hourlyMeasurement.getTime(), Frequency.HOURLY),
				hourlyMeasurement.getPm2_5().getValue(),
				hourlyMeasurement.getPm2_5().getValue(),
				false, false,
				hourlyMeasurement.getDevice().getSite().getSearchName(),
				hourlyMeasurement.getDevice().getSite().getLocation(),
				Frequency.HOURLY, hourlyMeasurement.getDevice().getSite().getId());
			insights.add(insight);
		}
		logger.info(String.valueOf(insights.size()));

		// forecast insights
		logger.info("Getting hourly forecast measurements .......");
		Date referenceDate = new Date();
		List<Insight> forecastInsights = new ArrayList<>();
		List<Forecast> devicesForecast = measurementService.getForecasts(startTime, null);
		for (Forecast forecast : devicesForecast) {
			boolean isForecast = forecast.getTime().compareTo(referenceDate) < 0;
			Insight insight = new Insight(
				formatTime(forecast.getTime(), Frequency.HOURLY), forecast.getPm2_5(), forecast.getPm2_5(),
				false, isForecast, forecast.getDevice().getSite().getSearchName(),
				forecast.getDevice().getSite().getLocation(), Frequency.HOURLY,
				forecast.getDevice().getSite().getId());
			forecastInsights.add(insight);
		}
		for (Insight insight : insights) {
			forecastInsights.removeIf(forecastInsight -> forecastInsight.equals(insight));
		}
		logger.info(String.valueOf(forecastInsights.size()));
		insights.addAll(forecastInsights);

		// placeholder insights
		logger.info("Creating hourly empty measurements .......");
		List<Insight> dbInsights = addEmptyInsights(Frequency.HOURLY, insights);

		logger.info("Inserting hourly measurements .......");
		logger.info(String.valueOf(dbInsights.size()));
		measurementService.insertInsights(dbInsights);
	}

	private List<Insight> addEmptyInsights(Frequency frequency, List<Insight> insights) {

		List<Site> sites = siteService.getSites(Tenant.AIRQO);
		Date placeHolderStartTime = DateUtils.addDays(new Date(), -timeBoundary);
		Date placeHolderEndTime = DateUtils.addDays(new Date(), timeBoundary);

		List<Insight> emptyInsights = new ArrayList<>();

		while (placeHolderStartTime.before(placeHolderEndTime)) {
			if (frequency == Frequency.DAILY) {
				placeHolderStartTime = DateUtils.addDays(placeHolderStartTime, 1);
			} else {
				placeHolderStartTime = DateUtils.addHours(placeHolderStartTime, 1);
			}

			for (Site site : sites) {
				Insight insight = new Insight(
					formatTime(placeHolderStartTime, frequency),
					getRandomValue(100.0),
					getRandomValue(50.0),
					true, false, site.getSearchName(),
					site.getLocation(), frequency, site.getId());
				emptyInsights.add(insight);
			}
		}

		for (Insight insight : insights) {
			emptyInsights.removeIf(placeHolderInsight -> placeHolderInsight.equals(insight));
		}
		logger.info(String.valueOf(emptyInsights.size()));
		insights.addAll(emptyInsights);

		return insights;
	}

	private void saveDailyInsights() {
		Date startTime = DateUtils.addDays(new Date(), -2);

		// daily insights
		logger.info("Getting daily measurements .......");
		List<Insight> insights = new ArrayList<>();
		List<DailyMeasurement> devicesDailyMeasurements = measurementService
			.getDailyMeasurements(null, startTime, Tenant.AIRQO);
		for (DailyMeasurement dailyMeasurement : devicesDailyMeasurements) {
			Insight insight = new Insight(
				formatTime(dailyMeasurement.getTime(), Frequency.DAILY),
				dailyMeasurement.getPm2_5().getValue(),
				dailyMeasurement.getPm2_5().getValue(),
				false, false,
				dailyMeasurement.getDevice().getSite().getSearchName(),
				dailyMeasurement.getDevice().getSite().getLocation(), Frequency.DAILY,
				dailyMeasurement.getDevice().getSite().getId());
			insights.add(insight);
		}
		logger.info(String.valueOf(insights.size()));

		// recent hourly insights
		logger.info("Getting recent hourly measurements .......");
		List<HourlyMeasurement> devicesHourlyMeasurements = measurementService
			.getRecentHourlyMeasurements(null, Tenant.AIRQO);

		logger.info(String.valueOf(devicesHourlyMeasurements.size()));

		for (HourlyMeasurement hourlyMeasurement : devicesHourlyMeasurements) {

			insights.removeIf(insight ->
				insight.getSiteId().equalsIgnoreCase(hourlyMeasurement.getDevice().getSite().getId()) &&
					insight.getTime().equals(hourlyMeasurement.getTime()));

			Insight insight = new Insight(
				formatTime(hourlyMeasurement.getTime(), Frequency.DAILY),
				hourlyMeasurement.getPm2_5().getValue(),
				hourlyMeasurement.getPm10().getValue(),
				false, false,
				hourlyMeasurement.getDevice().getSite().getSearchName(),
				hourlyMeasurement.getDevice().getSite().getLocation(), Frequency.DAILY,
				hourlyMeasurement.getDevice().getSite().getId());

			insights.add(insight);
		}

		// placeholder insights
		logger.info("Creating daily empty measurements .......");
		List<Insight> dbInsights = addEmptyInsights(Frequency.DAILY, insights);

		logger.info("Inserting daily measurements .......");
		logger.info(String.valueOf(dbInsights.size()));
		measurementService.insertInsights(dbInsights);
	}

	private double getRandomValue(Double maxValue) {
		double random = Math.random();
		return 50.0 + (random * (maxValue - 50.0));
	}
}
