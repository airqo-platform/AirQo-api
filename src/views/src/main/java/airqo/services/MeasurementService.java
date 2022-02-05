package airqo.services;

import airqo.models.*;
import com.querydsl.core.types.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

import java.util.Date;
import java.util.List;

public interface MeasurementService {

	List<Insight> getInsights(Frequency frequency, Date startTime, Date endTime, List<String> siteIds);

	List<Insight> getInsightsBefore(Date beforeTime);

	void saveInsights(List<Insight> insights);

	void insertInsights(List<Insight> insights);

	List<Insight> insertAndCacheInsights(List<Insight> insights);

	void deleteInsightsBefore(Date date);

	Page<HourlyMeasurement> getHourlyMeasurements(Pageable pageable, Predicate predicate);

	List<HourlyMeasurement> getHourlyMeasurements(@Nullable Device device, @NonNull Date startTime, @NonNull Tenant tenant);

	//TODO : reimplement recent functionality
	List<HourlyMeasurement> getRecentHourlyMeasurements(@Nullable Device device, @Nullable Tenant tenant);

	void insertMeasurements(List<HourlyMeasurement> hourlyMeasurements);

	void insertMeasurement(HourlyMeasurement hourlyMeasurement);
}
