package airqo.repository;

import airqo.models.Event;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.querydsl.QuerydslPredicateExecutor;
import org.springframework.stereotype.Repository;

import java.util.Date;
import java.util.List;

@Repository
public interface EventRepository extends MongoRepository<Event, String>, QuerydslPredicateExecutor<Event> {

	//	Queries recent events
	Page<Event> getTopByTimeAndDevice_Id(Date time, String deviceId, Pageable pageable);

	Page<Event> getTopByTimeAndDevice_Site_Id(Date time, String siteId, Pageable pageable);

	//	Queries for device
	Page<Event> getAllByDevice_Id(String id, Pageable pageable);

	Page<Event> getAllByDevice_IdAndTimeAfter(String id, Date startTime, Pageable pageable);

	Page<Event> getAllByDevice_IdAndTimeBefore(String id, Date endTime, Pageable pageable);

	Page<Event> getAllByDevice_IdAndTimeAfterAndTimeBefore(String id, Date startTime, Date endTime, Pageable pageable);

	//	Queries for devices
	Page<Event> getAllByDevice_IdIn(List<String> ids, Pageable pageable);

	Page<Event> getAllByDevice_IdInAndTimeAfter(List<String> id, Date startTime, Pageable pageable);

	Page<Event> getAllByDevice_IdInAndTimeBefore(List<String> id, Date endTime, Pageable pageable);

	Page<Event> getAllByDevice_IdInAndTimeAfterAndTimeBefore(List<String> id, Date startTime, Date endTime, Pageable pageable);


	//	Queries for site
	Page<Event> getAllByDevice_Site_Id(String id, Pageable pageable);

	Page<Event> getAllByDevice_Site_IdAndTimeAfter(String id, Date startTime, Pageable pageable);

	Page<Event> getAllByDevice_Site_IdAndTimeBefore(String id, Date endTime, Pageable pageable);

	Page<Event> getAllByDevice_Site_IdAndTimeAfterAndTimeBefore(String id, Date startTime, Date endTime, Pageable pageable);

}
