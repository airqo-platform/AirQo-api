package airqo.utils;

import airqo.models.Insight;
import airqo.services.MeasurementService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;


@Slf4j
@Profile({"messageBroker"})
@Component
public class InsightsScheduledTasks {

	private final MeasurementService measurementService;

	@Autowired
	public InsightsScheduledTasks(MeasurementService measurementService) {
		this.measurementService = measurementService;
	}

	@Scheduled(cron = "@hourly")
	public void insightsTasks() {
		removeForecastInsights();
		removeOldInsights();
	}

	public void removeForecastInsights() {

		List<Insight> forecastInsights = measurementService.getInsights(new Date(), true);
		List<Insight> insights = new ArrayList<>();
		log.info("Running Delete forecast insights");
		for (Insight insight : forecastInsights) {
			insight.setForecast(false);
			insights.add(insight);
		}
		measurementService.saveInsights(insights);
	}

	public void removeOldInsights() {

		Date dateTime = new Date();
		measurementService.deleteInsightsBefore(dateTime);

	}
}
