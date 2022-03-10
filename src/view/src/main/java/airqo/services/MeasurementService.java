package airqo.services;

import airqo.models.Frequency;
import airqo.models.Insight;
import airqo.models.Measurement;
import com.querydsl.core.types.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Date;
import java.util.List;

public interface MeasurementService {

	List<Insight> getInsights(Frequency frequency, Date startTime, Date endTime, List<String> siteIds);

	List<Insight> apiGetInsights(Predicate predicate);

	Page<Measurement> apiGetMeasurements(Predicate predicate, Pageable pageable);

	List<Insight> getInsightsBefore(Date beforeTime);

	void saveInsights(List<Insight> insights);

	void insertInsights(List<Insight> insights);

	void saveMeasurements(List<Measurement> measurements);

	void deleteInsightsBefore(Date date);

}
