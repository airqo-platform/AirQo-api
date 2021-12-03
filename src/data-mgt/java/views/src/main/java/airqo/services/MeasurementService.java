package airqo.services;

import airqo.models.HourlyMeasurement;
import airqo.models.Measurement;
import airqo.models.RawMeasurement;
import com.querydsl.core.types.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.util.MultiValueMap;

import java.util.List;
import java.util.Map;

public interface MeasurementService {
	Page<RawMeasurement> getRawMeasurements(Pageable pageable, MultiValueMap<String, String> parameters);

	Page<RawMeasurement> getRawMeasurements(Pageable pageable, Predicate predicate);

	Page<HourlyMeasurement> getHourlyMeasurements(Pageable pageable, Predicate predicate);

	void insertMeasurements(List<RawMeasurement> rawMeasurements, List<HourlyMeasurement> hourlyMeasurements);
}
