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

import static airqo.config.Constants.dateTimeHourlyFormat;


@Profile({"insights-job"})
@Component
public class InsightsScheduledTasks {

	private static final Logger logger = LoggerFactory.getLogger(InsightsScheduledTasks.class);
	final SimpleDateFormat simpleDateFormat = new SimpleDateFormat(dateTimeHourlyFormat);
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

		int exitCode = SpringApplication.exit(context, () -> 0);
		System.exit(exitCode);
	}

	public void saveHourlyInsights() {

		List<Insight> placeHolderInsights = new ArrayList<>();
		List<Insight> insights = new ArrayList<>();
		Date startTime = DateUtils.addHours(new Date(), -4);

		List<Forecast> devicesForecast = measurementService.getForecasts(startTime, null);
		List<HourlyMeasurement> devicesHourlyMeasurements = measurementService
			.getHourlyMeasurements(null, startTime, Tenant.AIRQO);

		try {
			List<Site> sites = siteService.getSites(Tenant.AIRQO);
			Date placeHolderStartTime = simpleDateFormat.parse(simpleDateFormat.format(new Date()));
			Date placeHolderEndTime = DateUtils.addDays(startTime, 40);

			while (placeHolderStartTime.before(placeHolderEndTime)) {
				placeHolderStartTime = DateUtils.addHours(placeHolderStartTime, 1);
				for (Site site : sites) {
					Insight insight = new Insight(
						placeHolderStartTime, getRandomValue(150.0), getRandomValue(100.0),
						true, false, site.getSearchName(),
						site.getLocation(), "hourly", site.getId());
					placeHolderInsights.add(insight);
				}
			}
		} catch (ParseException e) {
			e.printStackTrace();
		}

		for (HourlyMeasurement hourlyMeasurement : devicesHourlyMeasurements) {
			devicesForecast.removeIf(forecast -> {
				return (forecast.getDevice() == hourlyMeasurement.getDevice())
					&& (forecast.getTime() == hourlyMeasurement.getTime());
			});

			Insight insight = new Insight(
				hourlyMeasurement.getTime(), hourlyMeasurement.getPm2_5().getCalibratedValue(),
				hourlyMeasurement.getPm2_5().getCalibratedValue(),
				false, false, hourlyMeasurement.getSite().getSearchName(),
				hourlyMeasurement.getSite().getLocation(), "hourly", hourlyMeasurement.getSite().getId());

			insights.add(insight);

		}

		Date referenceDate = new Date();
		for (Forecast forecast : devicesForecast) {

			boolean isForecast = !forecast.getTime().before(referenceDate);

			Insight insight = new Insight(
				forecast.getTime(), forecast.getPm2_5(), forecast.getPm2_5(),
				false, isForecast, forecast.getDevice().getSite().getSearchName(),
				forecast.getDevice().getSite().getLocation(), "hourly",
				forecast.getDevice().getSite().getId());
			insights.add(insight);

		}

		for (Insight insight : insights) {
			placeHolderInsights.removeIf(placeHolderInsight -> (insight.getSiteId().equalsIgnoreCase(placeHolderInsight.getSiteId()))
				&& (placeHolderInsight.getTime() == insight.getTime()));
		}

		insights.addAll(placeHolderInsights);
		measurementService.insertInsights(insights);
	}

	public void saveDailyInsights() {

		List<Insight> placeHolderInsights = new ArrayList<>();
		List<Insight> insights = new ArrayList<>();
		Date startTime = DateUtils.addDays(new Date(), -2);
		List<DailyMeasurement> devicesDailyMeasurements = measurementService
			.getDailyMeasurements(null, startTime, Tenant.AIRQO);

		try {
			List<Site> sites = siteService.getSites(Tenant.AIRQO);
			Date placeHolderStartTime = simpleDateFormat.parse(simpleDateFormat.format(new Date()));
			Date placeHolderEndTime = DateUtils.addDays(startTime, 40);

			while (placeHolderStartTime.before(placeHolderEndTime)) {
				placeHolderStartTime = DateUtils.addDays(placeHolderStartTime, 1);
				for (Site site : sites) {
					Insight insight = new Insight(
						placeHolderStartTime, getRandomValue(150.0), getRandomValue(100.0),
						true, false, site.getSearchName(),
						site.getLocation(), "daily", site.getId());
					placeHolderInsights.add(insight);
				}
			}
		} catch (ParseException e) {
			e.printStackTrace();
		}

		for (DailyMeasurement dailyMeasurement : devicesDailyMeasurements) {

			Insight insight = new Insight(
				dailyMeasurement.getTime(), dailyMeasurement.getPm2_5().getCalibratedValue(),
				dailyMeasurement.getPm2_5().getCalibratedValue(),
				false, false, dailyMeasurement.getSite().getSearchName(),
				dailyMeasurement.getSite().getLocation(), "daily", dailyMeasurement.getSite().getId());

			insights.add(insight);

		}

		for (Insight insight : insights) {
			placeHolderInsights.removeIf(placeHolderInsight -> (insight.getSiteId().equalsIgnoreCase(placeHolderInsight.getSiteId()))
				&& (placeHolderInsight.getTime() == insight.getTime()));
		}

		insights.addAll(placeHolderInsights);

		startTime = DateUtils.addHours(new Date(), -1);

		List<HourlyMeasurement> devicesHourlyMeasurements = measurementService
			.getHourlyMeasurements(null, startTime, Tenant.AIRQO);

		for (HourlyMeasurement hourlyMeasurement : devicesHourlyMeasurements) {

			insights.removeIf(insight -> insight.getSiteId().equalsIgnoreCase(hourlyMeasurement.getSite().getId()) &&
				insight.getTime().equals(hourlyMeasurement.getTime()));

			Insight insight = new Insight(
				hourlyMeasurement.getTime(), hourlyMeasurement.getPm2_5().getCalibratedValue(),
				hourlyMeasurement.getPm2_5().getCalibratedValue(),
				false, false, hourlyMeasurement.getSite().getSearchName(),
				hourlyMeasurement.getSite().getLocation(), "daily", hourlyMeasurement.getSite().getId());

			logger.info(insight.toString());
			insights.add(insight);

		}

		measurementService.insertInsights(insights);
	}

	private double getRandomValue(Double maxValue) {
		double random = Math.random();
		return 1.0 + (random * (maxValue - 1.0));
	}
}
