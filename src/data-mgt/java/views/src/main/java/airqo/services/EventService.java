package airqo.services;

import airqo.models.Event;
import com.querydsl.core.types.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.util.MultiValueMap;

import java.util.List;
import java.util.Map;

public interface EventService {
	Page<Event> getEvents(Pageable pageable, MultiValueMap<String, String> parameters);

	Page<Event> getEvents(Pageable pageable, Map<String, String> parameters);

	Page<Event> getEvents(Pageable pageable, Predicate predicate);

	Page<Event> getEvents(Pageable pageable, Predicate predicate, MultiValueMap<String, String> parameters);

	void insertEvents(List<Event> events);
}
