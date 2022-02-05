package airqo.repository;

import airqo.models.Device;
import airqo.models.HourlyMeasurement;
import airqo.models.QHourlyMeasurement;
import com.querydsl.core.types.dsl.StringPath;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.querydsl.QuerydslPredicateExecutor;
import org.springframework.data.querydsl.binding.QuerydslBinderCustomizer;
import org.springframework.data.querydsl.binding.QuerydslBindings;
import org.springframework.stereotype.Repository;

import java.util.Date;
import java.util.List;

@Repository
public interface HourlyMeasurementRepository extends MongoRepository<HourlyMeasurement, String>, QuerydslPredicateExecutor<HourlyMeasurement>, QuerydslBinderCustomizer<QHourlyMeasurement> {

	@Override
	default void customize(QuerydslBindings bindings, QHourlyMeasurement root) {
		bindings.bind(String.class).first(
			(StringPath path, String value) -> path.containsIgnoreCase(value));
		bindings.excluding(root.time);
	}

	List<HourlyMeasurement> findAllByDeviceAndTimeGreaterThanEqual(Device device, Date startTime);

	HourlyMeasurement findTopByDeviceOrderByTimeDesc(Device device);

}
