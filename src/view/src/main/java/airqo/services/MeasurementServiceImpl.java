package airqo.services;

import airqo.Utils;
import airqo.models.Frequency;
import airqo.models.Insight;
import airqo.repository.InsightRepository;
import com.google.common.collect.Lists;
import com.querydsl.core.types.Predicate;
import io.sentry.spring.tracing.SentrySpan;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
public class MeasurementServiceImpl implements MeasurementService {

	@Autowired
	BigQueryApi bigQueryApi;

	@Autowired
	InsightRepository insightRepository;

	@Override
	@SentrySpan
	@Cacheable(value = "apiInsightsCache", cacheNames = {"apiInsightsCache"}, unless = "#result.size() <= 0")
	public List<Insight> apiGetInsights(Predicate predicate) {
		return Lists.newArrayList(insightRepository.findAll(predicate));
	}

	@Override
	@SentrySpan
	@Cacheable(value = "appInsightsCacheV2", cacheNames = {"appInsightsCacheV2"}, unless = "#result.size() <= 0")
	public List<Insight> apiGetInsights(Date startDateTime, Date endDateTime, List<String> siteIds) {

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

	@Override
	public List<Insight> getForecastInsightsBefore(Date beforeTime) {
		return insightRepository.findAllByTimeBeforeAndForecast(beforeTime, true);
	}

	@Override
	public void saveInsights(List<Insight> insights) {
		insightRepository.saveAll(insights);
	}

	@Override
	public void insertInsights(List<Insight> insights) {
		for (Insight insight : insights) {
			try {
				insightRepository.insert(insight);
			} catch (Exception e) {
				log.info(e.toString());
			}
		}
	}

	@Override
	public void deleteInsightsBefore(Date date) {
		log.info(String.format("Deleting Insights before %s", date));
		insightRepository.deleteAllByTimeBefore(date);
	}

}
