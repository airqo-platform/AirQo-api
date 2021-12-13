package airqo.repository;

import airqo.models.DailyMeasurement;
import airqo.models.Device;
import airqo.models.QDailyMeasurement;
import com.querydsl.core.types.dsl.StringPath;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.querydsl.QuerydslPredicateExecutor;
import org.springframework.data.querydsl.binding.QuerydslBinderCustomizer;
import org.springframework.data.querydsl.binding.QuerydslBindings;
import org.springframework.stereotype.Repository;

import java.util.Date;
import java.util.List;

@Repository
public interface DailyMeasurementRepository extends MongoRepository<DailyMeasurement, String>, QuerydslPredicateExecutor<DailyMeasurement>, QuerydslBinderCustomizer<QDailyMeasurement> {

	@Override
	default void customize(QuerydslBindings bindings, QDailyMeasurement root) {
		bindings.bind(String.class).first(
			(StringPath path, String value) -> path.containsIgnoreCase(value));
		bindings.excluding(root.time);
	}

	List<DailyMeasurement> findAllByDeviceAndTimeGreaterThanEqual(Device device, Date startTime);

}
