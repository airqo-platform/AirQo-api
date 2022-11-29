package airqo;

import airqo.models.Frequency;
import airqo.models.Insight;
import airqo.services.BigQueryApi;
import lombok.extern.slf4j.Slf4j;
import org.joda.time.DateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.stream.Collectors;

import static airqo.config.Constants.dateTimeFormat;
import static airqo.config.Constants.insightsExtraDays;

@Slf4j
@Component
public class Utils {
	@Autowired
	BigQueryApi bigQueryApi;

	public static HashMap<String, Date> getInsightsQueryDates() {

		HashMap<String, Date> results = new HashMap<>();

		try {
			final Date now = new Date();
			final SimpleDateFormat startDateFormat = new SimpleDateFormat("yyyy-MM-01");

			DateTime startDateTime = new DateTime(startDateFormat.parse(startDateFormat.format(now)));
			while (startDateTime.getDayOfWeek() != 1) {
				startDateTime = startDateTime.minusDays(1);
			}

			DateTime endDateTime = new DateTime(startDateFormat.parse(startDateFormat.format(now)));
			endDateTime = endDateTime.plusMonths(1);
			endDateTime = endDateTime.minusDays(1);
			while (endDateTime.getDayOfWeek() != 7) {
				endDateTime = endDateTime.plusDays(1);
			}

			final SimpleDateFormat simpleDayFormat = new SimpleDateFormat("yyyy-MM-dd");
			String startDateTimeStr = String.format("%sT00:00:00Z", simpleDayFormat.format(startDateTime.toDate()));
			String endDateTimeStr = String.format("%sT23:59:59Z", simpleDayFormat.format(endDateTime.toDate()));

			final SimpleDateFormat simpleDateTimeFormat = new SimpleDateFormat(dateTimeFormat);
			results.put("startDateTime", simpleDateTimeFormat.parse(startDateTimeStr));
			results.put("endDateTime", simpleDateTimeFormat.parse(endDateTimeStr));
		} catch (ParseException ignored) {

		}

		return results;
	}

	public static List<Date> getDatesArray(Date startDateTime, Date endDateTime, Frequency frequency) {

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

	public static List<Insight> fillMissingInsights(List<Insight> insights, Date startDateTime,
													Date endDateTime, String siteId, Frequency frequency) {

		Random random = new Random();
		List<Insight> siteInsights = new ArrayList<>(insights);
		List<Date> insightsDateArray = siteInsights.stream().map(Insight::getTime).toList();


		List<Insight> missingData = Utils.getDatesArray(startDateTime, endDateTime, frequency)
			.stream()
			.filter(date -> !insightsDateArray.contains(date))
			.map(date -> {

				Insight insight = new Insight();
				insight.setTime(date);
				insight.setFrequency(frequency);
				insight.setForecast(false);
				insight.setEmpty(true);
				insight.setSiteId(siteId);
				insight.setId(new Insight.InsightId(insight.getTime(), insight.getFrequency(), insight.getSiteId()).toString());

				if (siteInsights.size() <= 1) {
					insight.setPm2_5(random.nextInt(125));
					insight.setPm10(random.nextInt(125));
				} else {
					Insight refInsight = siteInsights.get(random.nextInt(siteInsights.size() - 1));
					insight.setPm2_5(refInsight.getPm2_5());
					insight.setPm10(refInsight.getPm10());
				}
				return insight;
			}).toList();

		siteInsights.addAll(missingData);

		return siteInsights;

	}

	public void updateInsightsCache(List<String> siteIds) {
		HashMap<String, Date> queryDates = Utils.getInsightsQueryDates();
		log.info(String.format("Query Dates : %s", queryDates));

		final DateTime startDateTime = new DateTime(queryDates.get("startDateTime")).minusDays(insightsExtraDays);
		final DateTime endDateTime = new DateTime(queryDates.get("endDateTime")).plusDays(insightsExtraDays);

		siteIds.forEach(s -> bigQueryApi.cacheInsights(startDateTime.toDate(), endDateTime.toDate(), s));
	}

}
