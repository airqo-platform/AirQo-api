package airqo.services;

import airqo.models.Frequency;
import airqo.models.GraphInsight;
import airqo.models.InsightData;
import lombok.extern.slf4j.Slf4j;
import org.joda.time.DateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.text.DecimalFormat;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;

@Slf4j
@Service
public class InsightsServiceImpl implements InsightsService {

	private final int extraDays = 1;
	@Autowired
	BigQueryApi bigQueryApi;

	private List<Date> getDatesArray(Date startDateTime, Date endDateTime, Frequency frequency) {

		DateTime varyingDate = new DateTime(startDateTime);

		List<Date> datesArray = new ArrayList<>();

		while (varyingDate.toDate().before(endDateTime)) {

			datesArray.add(varyingDate.toDate());

			varyingDate = switch (frequency) {
				case HOURLY -> varyingDate.plusHours(1);
				case DAILY -> varyingDate.plusDays(1);
			};
		}

		final SimpleDateFormat simpleDateFormat = new SimpleDateFormat(frequency.dateTimeFormat());

		return datesArray.stream().map(date -> {
			try {
				return simpleDateFormat.parse(simpleDateFormat.format(date));
			} catch (ParseException e) {
				return date;
			}
		}).collect(Collectors.toList());
	}

	private void fillMissingInsights(List<GraphInsight> insights, Date startDateTime,
									 Date endDateTime, String siteId, Frequency frequency, Boolean isForecast) {

		Random random = new Random();
		List<Date> insightsDateArray = insights.stream().map(GraphInsight::getTime).toList();

		List<GraphInsight> missingData = getDatesArray(startDateTime, endDateTime, frequency)
			.stream()
			.filter(date -> !insightsDateArray.contains(date))
			.map(date -> {

				GraphInsight insight = new GraphInsight();
				insight.setTime(date);
				insight.setFrequency(frequency);
				insight.setForecast(isForecast);
				insight.setAvailable(false);
				insight.setSiteId(siteId);

				if (insights.size() <= 1) {
					insight.setPm2_5(random.nextInt(125));
					insight.setPm10(random.nextInt(125));
				} else {
					GraphInsight refInsight = insights.get(random.nextInt(insights.size() - 1));
					insight.setPm2_5(refInsight.getPm2_5());
					insight.setPm10(refInsight.getPm10());
				}
				return insight;
			}).toList();

		insights.addAll(missingData);

	}

	private List<GraphInsight> removeOutliers(List<GraphInsight> insights, Date startDateTime, Date endDateTime) {

		return insights.stream().filter(insight -> (insight.getTime().after(startDateTime) && insight.getTime().before(endDateTime)) || insight.getTime().equals(startDateTime) || insight.getTime().equals(endDateTime)).collect(Collectors.toList());
	}

	private List<GraphInsight> formatInsightsData(List<GraphInsight> insights, int utcOffSet) {

		final SimpleDateFormat hourlyDateFormat = new SimpleDateFormat(Frequency.HOURLY.dateTimeFormat());
		final SimpleDateFormat dailyDateFormat = new SimpleDateFormat(Frequency.DAILY.dateTimeFormat());

		return insights.stream().peek(insight -> {

			try {
				DateTime dateTime = new DateTime(insight.getTime());
				if (utcOffSet < 0) {
					dateTime = dateTime.minusHours(utcOffSet);
				} else {
					dateTime = dateTime.plusHours(utcOffSet);
				}

				insight.setTime(dateTime.toDate());
				insight.setPm10(Double.parseDouble(new DecimalFormat("#.##").format(insight.getPm10())));
				insight.setPm2_5(Double.parseDouble(new DecimalFormat("#.##").format(insight.getPm2_5())));

				switch (insight.getFrequency()) {
					case DAILY -> insight.setTime(dailyDateFormat.parse(dailyDateFormat.format(insight.getTime())));
					case HOURLY -> insight.setTime(hourlyDateFormat.parse(hourlyDateFormat.format(insight.getTime())));
				}

			} catch (Exception ignored) {
			}
		}).sorted(Comparator.comparing(GraphInsight::getTime)).collect(Collectors.toList());
	}

	@Async
	private CompletableFuture<List<GraphInsight>> createForecastInsights(List<GraphInsight> insights, String siteId, int utcOffSet) {

		List<GraphInsight> forecastInsights = insights.stream().filter(GraphInsight::getForecast)
			.collect(Collectors.toList());

		forecastInsights = new ArrayList<>(new HashSet<>(forecastInsights));

		try {

			final SimpleDateFormat dailyDateFormat = new SimpleDateFormat(Frequency.DAILY.dateTimeFormat());

			Date today = dailyDateFormat.parse(dailyDateFormat.format(new Date()));

			final DateTime startDateTime = utcOffSet < 0 ? new DateTime(today).plusHours(utcOffSet) : new DateTime(today).minusHours(utcOffSet);
			final DateTime endDateTime = new DateTime(startDateTime).plusDays(2);

			forecastInsights = forecastInsights.stream().filter(insight -> (insight.getTime().after(startDateTime.toDate()) && insight.getTime().before(endDateTime.toDate())) || insight.getTime().equals(startDateTime.toDate()) || insight.getTime().equals(endDateTime.toDate())).collect(Collectors.toList());

			fillMissingInsights(forecastInsights, startDateTime.toDate(), endDateTime.toDate(), siteId, Frequency.HOURLY, true);

		} catch (ParseException e) {
			throw new RuntimeException(e);
		}

		return CompletableFuture.completedFuture(formatInsightsData(forecastInsights, utcOffSet));
	}

	private CompletableFuture<List<GraphInsight>> createHistoricalInsights(List<GraphInsight> historicalInsights, Date startDateTime, Date endDateTime, String siteId, int utcOffSet, Frequency frequency) {

		List<GraphInsight> insights = historicalInsights.stream().filter(insight ->
				insight.getFrequency() == frequency && !insight.getForecast())
			.collect(Collectors.toList());

		insights = new ArrayList<>(new HashSet<>(insights));

		Date dataStartDateTime = new DateTime(startDateTime).minusDays(extraDays).toDate();
		Date dataEndDateTime = new DateTime(endDateTime).plusDays(extraDays).toDate();

		fillMissingInsights(insights, dataStartDateTime, dataEndDateTime, siteId, frequency, false);

		insights = formatInsightsData(insights, utcOffSet);
		return CompletableFuture.completedFuture(removeOutliers(insights, startDateTime, endDateTime));
	}

	@Override
	@Cacheable(value = "appInsightsApiCache", cacheNames = {"appInsightsApiCache"}, unless = "#result.forecast.isEmpty() && #result.historical.isEmpty()")
	public InsightData getInsights(Date startDateTime, Date endDateTime, String siteId, int utcOffSet) {

		try {
			Date dataStartDateTime = new DateTime(startDateTime).minusDays(extraDays).toDate();
			Date dataEndDateTime = new DateTime(endDateTime).plusDays(extraDays).toDate();

			List<GraphInsight> insights = this.bigQueryApi.getInsights(dataStartDateTime, dataEndDateTime, siteId);

			// Historical
			CompletableFuture<List<GraphInsight>> hourlyInsights = createHistoricalInsights(insights, startDateTime, endDateTime, siteId, utcOffSet, Frequency.HOURLY);
			CompletableFuture<List<GraphInsight>> dailyInsights = createHistoricalInsights(insights, startDateTime, endDateTime, siteId, utcOffSet, Frequency.DAILY);

			// Forecast insights
			CompletableFuture<List<GraphInsight>> forecastInsights = createForecastInsights(insights, siteId, utcOffSet);

			CompletableFuture.allOf(forecastInsights, hourlyInsights, dailyInsights).join();


			List<GraphInsight> historicalInsights = new ArrayList<>();
			historicalInsights.addAll(hourlyInsights.get());
			historicalInsights.addAll(dailyInsights.get());

			return new InsightData(forecastInsights.get(), historicalInsights);
		} catch (InterruptedException | ExecutionException e) {
			throw new RuntimeException(e);
		}

	}
}
