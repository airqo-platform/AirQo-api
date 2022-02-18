package airqo.services;

import airqo.models.Frequency;
import airqo.models.Insight;
import airqo.models.QInsight;
import airqo.repository.InsightRepository;
import com.google.common.collect.Lists;
import com.querydsl.core.types.Predicate;
import io.sentry.spring.tracing.SentrySpan;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;

@Slf4j
@Service
public class MeasurementServiceImpl implements MeasurementService {

	private final InsightRepository insightRepository;

	@Autowired
	public MeasurementServiceImpl(InsightRepository insightRepository) {
		this.insightRepository = insightRepository;
	}

	@Override
	@SentrySpan
	@Cacheable(value = "insightsCache", cacheNames = {"insightsCache"}, unless = "#result.size() <= 0")
	public List<Insight> getInsights(Frequency frequency, Date startTime, Date endTime, List<String> siteIds) {

		QInsight qInsight = QInsight.insight;
		Predicate predicate = qInsight.frequency.equalsIgnoreCase(frequency.toString())
			.and(qInsight.siteId.in(siteIds))
			.and(qInsight.time.goe(startTime))
			.and(qInsight.time.loe(endTime));
		log.info(predicate.toString());
		return Lists.newArrayList(insightRepository.findAll(predicate));

	}

	@Override
	@SentrySpan
	@Cacheable(value = "apiInsightsCache", cacheNames = {"apiInsightsCache"}, unless = "#result.size() <= 0")
	public List<Insight> apiGetInsights(Predicate predicate) {
		return Lists.newArrayList(insightRepository.findAll(predicate));
	}

	@Override
	public List<Insight> getInsightsBefore(Date beforeTime) {
		return insightRepository.findAllByTimeBefore(beforeTime);
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
		log.info(String.format("Deleting insights before %s", date));
		insightRepository.deleteAllByTimeBefore(date);
	}

}
