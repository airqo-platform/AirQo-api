package airqo.repository;

import airqo.models.HourlyMeasurement;
import airqo.models.QHourlyMeasurement;
import com.querydsl.core.types.dsl.StringPath;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

	//	Queries recent measurements
	Page<HourlyMeasurement> getTopByTimeAndDevice_Id(Date time, String deviceId, Pageable pageable);

	Page<HourlyMeasurement> getTopByTimeAndDevice_Site_Id(Date time, String siteId, Pageable pageable);

	//	Queries for device
	Page<HourlyMeasurement> getAllByDevice_Id(String id, Pageable pageable);

	Page<HourlyMeasurement> getAllByDevice_IdAndTimeAfter(String id, Date startTime, Pageable pageable);

	Page<HourlyMeasurement> getAllByDevice_IdAndTimeBefore(String id, Date endTime, Pageable pageable);

	Page<HourlyMeasurement> getAllByDevice_IdAndTimeAfterAndTimeBefore(String id, Date startTime, Date endTime, Pageable pageable);

	//	Queries for devices
	Page<HourlyMeasurement> getAllByDevice_IdIn(List<String> ids, Pageable pageable);

	Page<HourlyMeasurement> getAllByDevice_IdInAndTimeAfter(List<String> id, Date startTime, Pageable pageable);

	Page<HourlyMeasurement> getAllByDevice_IdInAndTimeBefore(List<String> id, Date endTime, Pageable pageable);

	Page<HourlyMeasurement> getAllByDevice_IdInAndTimeAfterAndTimeBefore(List<String> id, Date startTime, Date endTime, Pageable pageable);


	//	Queries for site
	Page<HourlyMeasurement> getAllByDevice_Site_Id(String id, Pageable pageable);

	Page<HourlyMeasurement> getAllByDevice_Site_IdAndTimeAfter(String id, Date startTime, Pageable pageable);

	Page<HourlyMeasurement> getAllByDevice_Site_IdAndTimeBefore(String id, Date endTime, Pageable pageable);

	Page<HourlyMeasurement> getAllByDevice_Site_IdAndTimeAfterAndTimeBefore(String id, Date startTime, Date endTime, Pageable pageable);

}
