package airqo.controllers;

import airqo.models.ApiResponseBody;
import airqo.models.Insight;
import airqo.models.InsightData;
import airqo.predicate.InsightPredicate;
import airqo.services.InsightsService;
import airqo.services.MeasurementService;
import com.querydsl.core.types.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.data.querydsl.binding.QuerydslPredicate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.Date;
import java.util.List;

import static airqo.config.Constants.dateTimeFormat;

@Slf4j
@Profile({"api"})
@RestController
@RequestMapping("measurements")
public class MeasurementController {

	@Autowired
	MeasurementService measurementService;

	@Autowired
	InsightsService insightsService;

	@Deprecated
	public ResponseEntity<ApiResponseBody> getInsights(
		@QuerydslPredicate(root = Insight.class, bindings = InsightPredicate.class) Predicate predicate) {
		log.info("{}", predicate);
		List<Insight> insights = measurementService.apiGetInsights(predicate);

		ApiResponseBody apiResponseBody = new ApiResponseBody("Operation Successful", insights);
		return new ResponseEntity<>(apiResponseBody, new HttpHeaders(), HttpStatus.OK);
	}

	@GetMapping("/app/insights")
	public ResponseEntity<ApiResponseBody> getInsightsData(@RequestParam() @DateTimeFormat(pattern = dateTimeFormat) Date startDateTime,
														   @RequestParam() @DateTimeFormat(pattern = dateTimeFormat) Date endDateTime,
														   @RequestParam() String siteId) {
		List<String> siteIds = Arrays.stream(siteId.split(",")).toList();
		log.info("\nStart Time: {} \nEnd time: {} \nSites: {}\n", startDateTime, endDateTime, siteIds);
		List<Insight> insights = measurementService.apiGetInsights(startDateTime, endDateTime, siteIds);

		ApiResponseBody apiResponseBody = new ApiResponseBody("Operation Successful", insights);
		return new ResponseEntity<>(apiResponseBody, new HttpHeaders(), HttpStatus.OK);
	}

	@GetMapping("/mobile-app/insights")
	public ResponseEntity<ApiResponseBody> getAppInsights(@RequestParam() @DateTimeFormat(pattern = dateTimeFormat) Date startDateTime,
														  @RequestParam() @DateTimeFormat(pattern = dateTimeFormat) Date endDateTime,
														  @RequestParam(required = false) Integer utcOffset,
														  @RequestParam() String siteId) {

		InsightData insights = insightsService.getInsights(startDateTime, endDateTime, siteId, utcOffset);

		ApiResponseBody apiResponseBody = new ApiResponseBody("Operation Successful", insights);
		return new ResponseEntity<>(apiResponseBody, new HttpHeaders(), HttpStatus.OK);
	}

}
