package airqo.services.impl;

import airqo.models.Event;
import airqo.repository.EventRepository;
import airqo.services.EventService;
import com.querydsl.core.types.Predicate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class EventServiceImpl implements EventService {

	@Autowired
	EventRepository eventRepository;

	@Override
	public Page<Event> getEvents(Pageable pageable, Predicate predicate) {
		return eventRepository.findAll(predicate, pageable);
	}

	@Override
	public void insertEvents(List<Event> events) {
		eventRepository.saveAll(events);
	}
}
