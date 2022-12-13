package airqo.services;

import airqo.Utils;
import airqo.models.Frequency;
import airqo.models.GraphInsight;
import airqo.models.Insight;
import airqo.models.InsightData;
import io.sentry.spring.tracing.SentrySpan;
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

import static airqo.config.Constants.insightsExtraDays;

@Slf4j
@Service
public class InsightsServiceImpl implements InsightsService {

	@Autowired
	BigQueryApi bigQueryApi;

	public void updateInsightsCache(List<String> siteIds) {
		HashMap<String, Date> queryDates = Utils.getInsightsQueryDates();
		log.info(String.format("Query Dates : %s", queryDates));

		final DateTime startDateTime = new DateTime(queryDates.get("startDateTime")).minusDays(insightsExtraDays);
		final DateTime endDateTime = new DateTime(queryDates.get("endDateTime")).plusDays(insightsExtraDays);

		siteIds.forEach(s -> bigQueryApi.cacheInsights(startDateTime.toDate(), endDateTime.toDate(), s));
	}

	@Override
	@SentrySpan
	@Cacheable(value = "appInsightsCacheV2", cacheNames = {"appInsightsCacheV2"}, unless = "#result.size() <= 0")
	public List<Insight> getInsights(Date startDateTime, Date endDateTime, List<String> siteIds) {

		List<Insight> insights = bigQueryApi.getInsightsData(startDateTime, endDateTime, siteIds);
		List<Insight> sitesInsights = new ArrayList<>();

		for (String siteId : siteIds) {
			List<Insight> siteInsights = insights.stream().filter(insight -> insight.getSiteId().equalsIgnoreCase(siteId)).toList();
			for (Frequency frequency : Frequency.values()) {
				List<Insight> frequencyInsights = siteInsights.stream().filter(insight -> insight.getFrequency() == frequency).toList();
				List<Insight> allSiteInsights = Utils.fillMissingInsights(frequencyInsights, startDateTime, endDateTime, siteId, frequency);
				sitesInsights.addAll(allSiteInsights);
			}
		}

		return sitesInsights.stream().peek(insight -> {
			try {
				insight.setPm10(Double.parseDouble(new DecimalFormat("#.##").format(insight.getPm10())));
				insight.setPm2_5(Double.parseDouble(new DecimalFormat("#.##").format(insight.getPm2_5())));
			} catch (Exception ignored) {
			}
		}).sorted(Comparator.comparing(Insight::getTime)).collect(Collectors.toList());

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

			forecastInsights = Utils.fillMissingInsights(forecastInsights, startDateTime.toDate(), endDateTime.toDate(), siteId, Frequency.HOURLY, true);

		} catch (ParseException e) {
			throw new RuntimeException(e);
		}

		return CompletableFuture.completedFuture(Utils.formatInsightsData(forecastInsights, utcOffSet));
	}

	@Async
	private CompletableFuture<List<GraphInsight>> createHistoricalInsights(List<GraphInsight> historicalInsights, Date startDateTime, Date endDateTime, String siteId, int utcOffSet, Frequency frequency) {

		List<GraphInsight> insights = historicalInsights.stream().filter(insight ->
				insight.getFrequency() == frequency && !insight.getForecast())
			.collect(Collectors.toList());

		insights = new ArrayList<>(new HashSet<>(insights));

		Date dataStartDateTime = new DateTime(startDateTime).minusDays(insightsExtraDays).toDate();
		Date dataEndDateTime = new DateTime(endDateTime).plusDays(insightsExtraDays).toDate();

		insights = Utils.fillMissingInsights(insights, dataStartDateTime, dataEndDateTime, siteId, frequency, false);

		insights = Utils.formatInsightsData(insights, utcOffSet);
		return CompletableFuture.completedFuture(Utils.removeOutliers(insights, startDateTime, endDateTime));
	}

	@Override
	@SentrySpan
	@Cacheable(value = "appInsightsApiCache", unless = "#result.forecast.isEmpty() && #result.historical.isEmpty()")
	public InsightData getInsights(Date startDateTime, Date endDateTime, String siteId, int utcOffSet) {

		try {
			Date dataStartDateTime = new DateTime(startDateTime).minusDays(insightsExtraDays).toDate();
			Date dataEndDateTime = new DateTime(endDateTime).plusDays(insightsExtraDays).toDate();

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
