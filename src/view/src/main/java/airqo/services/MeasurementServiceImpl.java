package airqo.services;

import airqo.models.Frequency;
import airqo.models.Insight;
import airqo.models.Measurement;
import airqo.models.QInsight;
import airqo.repository.InsightRepository;
import airqo.repository.MeasurementRepository;
import com.google.common.collect.Lists;
import com.querydsl.core.types.Predicate;
import io.sentry.spring.tracing.SentrySpan;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;

import java.util.Calendar;
import java.util.Date;
import java.util.List;

import static org.springframework.data.mongodb.core.aggregation.Aggregation.*;

@Slf4j
@Service
public class MeasurementServiceImpl implements MeasurementService {

	private final InsightRepository insightRepository;
	private final MeasurementRepository measurementRepository;
	private final MongoOperations mongoOperations;
	@Value("${latestInsightsTimeLimit}")
	private int latestInsightsTimeLimit;

	@Autowired
	public MeasurementServiceImpl(InsightRepository insightRepository, MeasurementRepository measurementRepository, MongoOperations mongoOperations) {
		this.insightRepository = insightRepository;
		this.measurementRepository = measurementRepository;
		this.mongoOperations = mongoOperations;
	}

	@Override
	@SentrySpan
	@Cacheable(value = "insightsCache", cacheNames = {"insightsCache"}, unless = "#result.size() <= 0")
	public List<Insight> getInsights(Frequency frequency, Date startTime, Date endTime, List<String> siteIds) {

		QInsight qInsight = QInsight.insight;
		Predicate predicate = qInsight.frequency.eq(frequency)
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
	@SentrySpan
	@Cacheable(value = "apiLatestInsightsCache", cacheNames = {"apiLatestInsightsCache"}, unless = "#result.size() <= 0")
	public List<Insight> apiGetLatestInsights() {

		Calendar cal = Calendar.getInstance();
		cal.setTime(new Date());
		cal.add(Calendar.HOUR, -latestInsightsTimeLimit);
		Date startDateTime = cal.getTime();

		Aggregation agg = newAggregation(
			match(Criteria.where("time").gt(startDateTime)
				.and("empty").is(false)
				.and("forecast").is(false)
				.and("frequency").is(Frequency.HOURLY)),
			group("siteId")
				.last("siteId").as("siteId")
				.last("forecast").as("forecast")
				.last("time").as("time")
				.last("pm2_5").as("pm2_5")
				.last("pm10").as("pm10")
				.last("name").as("name")
				.last("location").as("location")
				.last("latitude").as("latitude")
				.last("longitude").as("longitude"),
			sort(Sort.Direction.DESC, "time")
		);

		AggregationResults<Insight> groupResults = mongoOperations.aggregate(agg, Insight.class, Insight.class);

		return groupResults.getMappedResults();
	}

	@Override
	public Page<Measurement> apiGetMeasurements(Predicate predicate, Pageable pageable) {
		return measurementRepository.findAll(predicate, pageable);
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
	public void saveMeasurements(List<Measurement> measurements) {
		measurementRepository.saveAll(measurements);
	}

	@Override
	public void deleteInsightsBefore(Date date) {
		log.info(String.format("Deleting Insights before %s", date));
		insightRepository.deleteAllByTimeBefore(date);
	}

}
