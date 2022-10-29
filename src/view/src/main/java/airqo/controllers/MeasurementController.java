package airqo.controllers;

import airqo.models.ApiResponseBody;
import airqo.models.Insight;
import airqo.predicate.InsightPredicate;
import airqo.services.MeasurementService;
import com.querydsl.core.types.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.data.querydsl.binding.QuerydslPredicate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Slf4j
@Profile({"api"})
@RestController
@RequestMapping("measurements")
public class MeasurementController {

	private final MeasurementService measurementService;

	@Autowired
	public MeasurementController(MeasurementService measurementService) {
		this.measurementService = measurementService;
	}

	@Deprecated
	@GetMapping("/app/insights")
	public ResponseEntity<ApiResponseBody> getInsights(
		@QuerydslPredicate(root = Insight.class, bindings = InsightPredicate.class) Predicate predicate) {
		log.info("{}", predicate);
		List<Insight> insights = measurementService.apiGetInsights(predicate);

		ApiResponseBody apiResponseBody = new ApiResponseBody("Operation Successful", insights);
		return new ResponseEntity<>(apiResponseBody, new HttpHeaders(), HttpStatus.OK);
	}

}
