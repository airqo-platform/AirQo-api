package airqo.controllers;

import airqo.models.Event;
import airqo.services.EventService;
import com.querydsl.core.types.Predicate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.querydsl.binding.QuerydslPredicate;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("events")
public class EventController {

    @Autowired
    EventService eventService;

    @GetMapping("")
    public ResponseEntity<?> getEvents(
            @QuerydslPredicate(root = Event.class) Predicate predicate,
            @PageableDefault(sort = "time") Pageable pageable,
            @RequestParam MultiValueMap<String, String> parameters
    ) {
        Page<Event> events = eventService.getEvents(pageable, predicate);
        return new ResponseEntity<>(events, new HttpHeaders(), HttpStatus.OK);
    }
}
