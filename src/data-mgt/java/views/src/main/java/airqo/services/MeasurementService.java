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

	List<Insight> getInsights(Frequency frequency, Date startTime, Date endTime, String siteId);

	List<Weather> getWeather(Frequency frequency, Date startTime, Date endTime, String siteId);

	void insertWeather(List<Weather> weather);

	void insertWeather(Weather weather);

	List<Insight> getInsights(Date beforeTime, boolean forecast);

	void saveInsights(List<Insight> insights);

	void insertInsights(List<Insight> insights);

	List<Insight> insertAndCacheInsights(List<Insight> insights);

	void insertInsight(Insight insight);

	void deleteInsights(Date laterDate, Date afterDate);

	void insertForecast(List<Forecast> forecasts);

	void insertForecast(Forecast forecast);

	List<Forecast> getForecasts(Date startTime, Device device);

	Page<HourlyMeasurement> getHourlyMeasurements(Pageable pageable, Predicate predicate);

	List<HourlyMeasurement> getHourlyMeasurements(@Nullable Device device, @NonNull Date startTime, @NonNull Tenant tenant);

	//TODO : reimplement recent functionality
	List<HourlyMeasurement> getRecentHourlyMeasurements(@Nullable Device device, @Nullable Tenant tenant);

	List<DailyMeasurement> getDailyMeasurements(@Nullable Device device, @NonNull Date startTime, @NonNull Tenant tenant);

	void insertMeasurements(List<HourlyMeasurement> hourlyMeasurements, List<DailyMeasurement> dailyMeasurements);

	void insertMeasurement(HourlyMeasurement hourlyMeasurement, DailyMeasurement dailyMeasurement);
}
