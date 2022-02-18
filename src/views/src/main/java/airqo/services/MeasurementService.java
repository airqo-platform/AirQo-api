package airqo.services;

import airqo.models.Frequency;
import airqo.models.Insight;
import com.querydsl.core.types.Predicate;

import java.util.Date;
import java.util.List;

public interface MeasurementService {

	List<Insight> getInsights(Frequency frequency, Date startTime, Date endTime, List<String> siteIds);

	List<Insight> apiGetInsights(Predicate predicate);

	List<Insight> getInsightsBefore(Date beforeTime);

	void saveInsights(List<Insight> insights);

	void insertInsights(List<Insight> insights);

	void deleteInsightsBefore(Date date);

}
