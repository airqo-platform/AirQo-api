package airqo.services;

import airqo.models.Insight;
import com.querydsl.core.types.Predicate;

import java.util.Date;
import java.util.List;

public interface MeasurementService {

	List<Insight> apiGetInsights(Predicate predicate);

	List<Insight> getForecastInsightsBefore(Date beforeTime);

	void saveInsights(List<Insight> insights);

	void insertInsights(List<Insight> insights);

	void deleteInsightsBefore(Date date);

}
