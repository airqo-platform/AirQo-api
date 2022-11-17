package airqo.services;

import airqo.models.Frequency;
import airqo.models.GraphInsight;
import airqo.models.InsightData;
import lombok.extern.slf4j.Slf4j;
import org.joda.time.DateTime;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.text.DecimalFormat;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class InsightsServiceImpl implements InsightsService {

	private final BigQueryApi bigQueryApi;

	public InsightsServiceImpl(BigQueryApi bigQueryApi) {
		this.bigQueryApi = bigQueryApi;
	}

	private List<Date> getDatesArray(Date startDateTime, Date endDateTime, Frequency frequency) {

		DateTime varyingDate = new DateTime(startDateTime);

		List<Date> datesArray = new ArrayList<>();

		while (varyingDate.toDate().before(endDateTime)) {

			datesArray.add(varyingDate.toDate());

			switch (frequency) {
				case HOURLY:
					varyingDate = varyingDate.plusHours(1);
					break;
				case DAILY:
					varyingDate = varyingDate.plusDays(1);
					break;
			}
		}

		final SimpleDateFormat simpleDateFormat = new SimpleDateFormat(frequency.dateTimeFormat());

		return datesArray.stream().map(date -> {
			String newDate = simpleDateFormat.format(date);
			try {
				return simpleDateFormat.parse(newDate);
			} catch (ParseException e) {
				return date;
			}
		}).collect(Collectors.toList());
	}

	private void fillMissingInsights(List<GraphInsight> insights, Date startDateTime,
									 Date endDateTime, String siteId, Frequency frequency, Boolean isForecast) {

		Random random = new Random();
		List<Date> insightsDateArray = insights.stream().map(GraphInsight::getTime).collect(Collectors.toList());

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
					insight.setPm2_5(random.nextInt(50));
					insight.setPm10(random.nextInt(100));
				} else {
					GraphInsight refInsight = insights.get(random.nextInt(insights.size() - 1));
					insight.setPm2_5(refInsight.getPm2_5());
					insight.setPm10(refInsight.getPm10());
				}
				return insight;
			}).collect(Collectors.toList());

		insights.addAll(missingData);

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
					case DAILY:
						insight.setTime(dailyDateFormat.parse(dailyDateFormat.format(insight.getTime())));
						break;
					case HOURLY:
						insight.setTime(hourlyDateFormat.parse(hourlyDateFormat.format(insight.getTime())));
						break;
					default:
						break;
				}

			} catch (Exception ignored) {
			}
		}).sorted(Comparator.comparing(GraphInsight::getTime)).collect(Collectors.toList());
	}

	private List<GraphInsight> createForecastInsights(List<GraphInsight> forecastInsights, String siteId, int utcOffSet) {

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

		return formatInsightsData(forecastInsights, utcOffSet);
	}

	private List<GraphInsight> createHistoricalInsights(List<GraphInsight> historicalInsights, Date startDateTime, Date endDateTime, String siteId, int utcOffSet) {

		historicalInsights = new ArrayList<>(new HashSet<>(historicalInsights));

		// Daily insights
		List<GraphInsight> historicalDailyInsights = historicalInsights.stream().filter(insight ->
				insight.getFrequency() == Frequency.DAILY)
			.collect(Collectors.toList());
		fillMissingInsights(historicalDailyInsights, startDateTime, endDateTime, siteId, Frequency.DAILY, false);

		// Hourly insights
		List<GraphInsight> historicalHourlyInsights = historicalInsights.stream().filter(insight ->
				insight.getFrequency() == Frequency.HOURLY)
			.collect(Collectors.toList());
		fillMissingInsights(historicalHourlyInsights, startDateTime, endDateTime, siteId, Frequency.HOURLY, false);

		// Insights
		historicalHourlyInsights.addAll(historicalDailyInsights);

		return formatInsightsData(historicalHourlyInsights, utcOffSet);
	}

	@Override
	@Cacheable(value = "appInsightsApiCache", cacheNames = {"appInsightsApiCache"}, unless = "#result.isEmpty()")
	public InsightData getInsights(Date startDateTime, Date endDateTime, String siteId, int utcOffSet) {

		DateTime start = new DateTime(startDateTime);
		DateTime end = new DateTime(endDateTime);

		if (utcOffSet < 0) {
			start = start.plusHours(utcOffSet);
			end = end.plusHours(utcOffSet);
		} else {
			start = start.minusHours(utcOffSet);
			end = end.minusHours(utcOffSet);
		}

		List<GraphInsight> insights = this.bigQueryApi.getInsights(start.toDate(), end.toDate(), siteId);

		// Historical
		List<GraphInsight> historicalInsights = insights.stream().filter(insight -> !insight.getForecast())
			.collect(Collectors.toList());
		historicalInsights = createHistoricalInsights(historicalInsights, start.toDate(), end.toDate(), siteId, utcOffSet);

		// Forecast insights
		List<GraphInsight> forecastInsights = insights.stream().filter(GraphInsight::getForecast)
			.collect(Collectors.toList());
		forecastInsights = createForecastInsights(forecastInsights, siteId, utcOffSet);

		return new InsightData(forecastInsights, historicalInsights);
	}
}
