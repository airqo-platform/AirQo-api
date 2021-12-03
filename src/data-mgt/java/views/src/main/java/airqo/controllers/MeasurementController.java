package airqo.controllers;

import airqo.models.HourlyMeasurement;
import airqo.models.Measurement;
import airqo.models.RawMeasurement;
import airqo.services.MeasurementService;
import com.querydsl.core.types.Predicate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
@RequestMapping("measurements")
public class MeasurementController {

	private static final Logger logger = LoggerFactory.getLogger(MeasurementController.class);

	@Autowired
	MeasurementService measurementService;

	@GetMapping("")
	public ResponseEntity<?> getMeasurements(
		@PageableDefault(sort = "time") Pageable pageable,
		@RequestParam MultiValueMap<String, String> parameters
	) {
		logger.info(String.valueOf(parameters));
		Page<RawMeasurement> measurements = measurementService.getRawMeasurements(pageable, parameters);
		return new ResponseEntity<>(measurements, new HttpHeaders(), HttpStatus.OK);
	}

	@GetMapping("/hourly")
	public ResponseEntity<?> getHourlyMeasurements(
		@QuerydslPredicate(root = HourlyMeasurement.class) Predicate predicate,
		@PageableDefault(sort = "time") Pageable pageable,
		@RequestParam MultiValueMap<String, String> parameters
	) {
		Page<HourlyMeasurement> measurements = measurementService.getHourlyMeasurements(pageable, predicate);
		return new ResponseEntity<>(measurements, new HttpHeaders(), HttpStatus.OK);
	}

	@GetMapping("/raw")
	public ResponseEntity<?> getRawMeasurements(
		@QuerydslPredicate(root = RawMeasurement.class) Predicate predicate,
		@PageableDefault(sort = "time") Pageable pageable,
		@RequestParam MultiValueMap<String, String> parameters
	) {
		Page<RawMeasurement> measurements = measurementService.getRawMeasurements(pageable, predicate);
		return new ResponseEntity<>(measurements, new HttpHeaders(), HttpStatus.OK);
	}

}
