package airqo.services;

import airqo.models.Event;
import com.querydsl.core.types.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface EventService {
    Page<Event> getEvents(Pageable pageable, Predicate predicate);

    void insertEvents(List<Event> events);
}
