package airqo;

import airqo.models.Frequency;
import airqo.models.Insight;
import org.joda.time.DateTime;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Random;
import java.util.stream.Collectors;

public class Utils {
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


		List<Insight> missingData = getDatesArray(startDateTime, endDateTime, frequency)
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

}
