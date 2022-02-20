package airqo.tasks;

import airqo.models.Insight;
import airqo.services.MeasurementService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;


@Slf4j
@Profile({"messageBroker"})
@Component
public class InsightsTasks {

	private final MeasurementService measurementService;

	@Autowired
	public InsightsTasks(MeasurementService measurementService) {
		this.measurementService = measurementService;
	}

	@Scheduled(cron = "@hourly")
	public void forecastInsightsTasks() {
		removeForecastInsights();
	}

	@Scheduled(cron = "@monthly")
	public void oldInsightsTasks() {
		removeOldInsights();
	}

	public void removeForecastInsights() {

		List<Insight> oldInsights = measurementService.getInsightsBefore(new Date());
		List<Insight> insights = new ArrayList<>();
		log.info("Running Delete forecast InsightsTasks");
		for (Insight insight : oldInsights) {
			insight.setForecast(false);
			insights.add(insight);
		}
		measurementService.saveInsights(insights);
	}

	public void removeOldInsights() {
		log.info("Running Delete old InsightsTasks");
		Calendar cal = Calendar.getInstance();
		cal.setTime(new Date());
		cal.add(Calendar.DAY_OF_MONTH, -50);
		Date dateTime = cal.getTime();
		measurementService.deleteInsightsBefore(dateTime);

	}
}
