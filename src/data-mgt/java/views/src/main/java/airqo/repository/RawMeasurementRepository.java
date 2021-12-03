package airqo.repository;

import airqo.models.QRawMeasurement;
import airqo.models.RawMeasurement;
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
public interface RawMeasurementRepository extends MongoRepository<RawMeasurement, String>, QuerydslPredicateExecutor<RawMeasurement>, QuerydslBinderCustomizer<QRawMeasurement> {

	@Override
	default void customize(QuerydslBindings bindings, QRawMeasurement root) {
		bindings.bind(String.class).first(
			(StringPath path, String value) -> path.containsIgnoreCase(value));
		bindings.excluding(root.time);
	}

	//	Queries recent measurements
	Page<RawMeasurement> getTopByTimeAndDevice_Id(Date time, String deviceId, Pageable pageable);

	Page<RawMeasurement> getTopByTimeAndDevice_Site_Id(Date time, String siteId, Pageable pageable);

	//	Queries for device
	Page<RawMeasurement> getAllByDevice_Id(String id, Pageable pageable);

	Page<RawMeasurement> getAllByDevice_IdAndTimeAfter(String id, Date startTime, Pageable pageable);

	Page<RawMeasurement> getAllByDevice_IdAndTimeBefore(String id, Date endTime, Pageable pageable);

	Page<RawMeasurement> getAllByDevice_IdAndTimeAfterAndTimeBefore(String id, Date startTime, Date endTime, Pageable pageable);

	//	Queries for devices
	Page<RawMeasurement> getAllByDevice_IdIn(List<String> ids, Pageable pageable);

	Page<RawMeasurement> getAllByDevice_IdInAndTimeAfter(List<String> id, Date startTime, Pageable pageable);

	Page<RawMeasurement> getAllByDevice_IdInAndTimeBefore(List<String> id, Date endTime, Pageable pageable);

	Page<RawMeasurement> getAllByDevice_IdInAndTimeAfterAndTimeBefore(List<String> id, Date startTime, Date endTime, Pageable pageable);

	//	Queries for site
	Page<RawMeasurement> getAllByDevice_Site_Id(String id, Pageable pageable);

	Page<RawMeasurement> getAllByDevice_Site_IdAndTimeAfter(String id, Date startTime, Pageable pageable);

	Page<RawMeasurement> getAllByDevice_Site_IdAndTimeBefore(String id, Date endTime, Pageable pageable);

	Page<RawMeasurement> getAllByDevice_Site_IdAndTimeAfterAndTimeBefore(String id, Date startTime, Date endTime, Pageable pageable);

}
