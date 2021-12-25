package airqo.services;

import airqo.models.*;
import com.querydsl.core.types.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;
import org.springframework.util.MultiValueMap;

import java.util.Date;
import java.util.List;

public interface MeasurementService {
	Page<RawMeasurement> getRawMeasurements(Pageable pageable, MultiValueMap<String, Object> parameters);

	Page<RawMeasurement> getRawMeasurements(Pageable pageable, Predicate predicate);

	List<Insight> getInsights(Frequency frequency, Date startTime, Date endTime, String tenant, String siteId);

	List<Insight> getInsights(Date beforeTime);

	void insertInsights(List<Insight> insights);

	void insertInsight(Insight insight);

	void deleteInsights(Date laterDate, Date afterDate);

	void insertForecast(List<Forecast> forecasts);

	void insertForecast(Forecast forecast);

	List<Forecast> getForecasts(Date startTime, Device device);

	Page<HourlyMeasurement> getHourlyMeasurements(Pageable pageable, Predicate predicate);

	List<HourlyMeasurement> getHourlyMeasurements(@Nullable Device device, @NonNull Date startTime, @NonNull Tenant tenant);

	List<HourlyMeasurement> getRecentHourlyMeasurements(@Nullable Device device, @Nullable Tenant tenant);

	List<DailyMeasurement> getDailyMeasurements(@Nullable Device device, @NonNull Date startTime, @NonNull Tenant tenant);

	void insertMeasurements(List<RawMeasurement> rawMeasurements,
							List<HourlyMeasurement> hourlyMeasurements, List<DailyMeasurement> dailyMeasurements);

	void insertMeasurement(RawMeasurement rawMeasurement, HourlyMeasurement hourlyMeasurement, DailyMeasurement dailyMeasurement);
}
