package airqo;

import airqo.models.Frequency;
import airqo.models.GraphInsight;
import airqo.models.Insight;
import lombok.extern.slf4j.Slf4j;
import org.joda.time.DateTime;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Slf4j
public class UtilsTests {

	@Test
	@DisplayName("Testing dates array")
	public void datesArray() throws ParseException {
		final SimpleDateFormat simpleDateFormat = new SimpleDateFormat(Frequency.DAILY.dateTimeFormat());

		Date startDateTime = simpleDateFormat.parse(simpleDateFormat.format(new Date()));
		Date endDateTime = new DateTime(new Date()).plusDays(10).toDate();

		List<Date> dates = Utils.getDatesArray(startDateTime, endDateTime, Frequency.DAILY);
		Assertions.assertEquals(dates.size(), 11);

		dates = Utils.getDatesArray(dates.get(0), dates.get(1), Frequency.HOURLY);
		Assertions.assertEquals(dates.size(), 24);
	}

	@Test
	@DisplayName("Testing filling missing data v1")
	public void fillMissingDataV1() throws ParseException {
		final SimpleDateFormat simpleDateFormat = new SimpleDateFormat(Frequency.DAILY.dateTimeFormat());

		Date startDateTime = simpleDateFormat.parse(simpleDateFormat.format(new Date()));
		Date endDateTime = new DateTime(startDateTime).plusDays(1).toDate();

		List<Insight> insights = Utils.fillMissingInsights(new ArrayList<>(), startDateTime, endDateTime, "123", Frequency.DAILY);
		Assertions.assertEquals(insights.size(), 1);

		insights = Utils.fillMissingInsights(new ArrayList<>(), startDateTime, endDateTime, "123", Frequency.HOURLY);
		Assertions.assertEquals(insights.size(), 24);
	}

	@Test
	@DisplayName("Testing filling missing data v2")
	public void fillMissingDataV2() throws ParseException {
		final SimpleDateFormat simpleDateFormat = new SimpleDateFormat(Frequency.DAILY.dateTimeFormat());

		Date startDateTime = simpleDateFormat.parse(simpleDateFormat.format(new Date()));
		Date endDateTime = new DateTime(startDateTime).plusDays(1).toDate();

		List<GraphInsight> insights = Utils.fillMissingInsights(new ArrayList<>(), startDateTime, endDateTime, "123", Frequency.DAILY, false);
		Assertions.assertEquals(insights.size(), 1);

		insights = Utils.fillMissingInsights(new ArrayList<>(), startDateTime, endDateTime, "123", Frequency.HOURLY, true);
		Assertions.assertEquals(insights.size(), 24);

		List<GraphInsight> forecastCount = insights.stream().filter(GraphInsight::getForecast).toList();
		Assertions.assertEquals(forecastCount.size(), 24);
	}
}
