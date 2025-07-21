package airqo.controllers;

import airqo.Utils;
import airqo.models.ApiResponseBody;
import airqo.models.Insight;
import airqo.models.InsightData;
import airqo.services.InsightsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
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
import java.util.HashMap;
import java.util.List;

import static airqo.config.Constants.dateTimeFormat;

@Slf4j
@Profile({"api"})
@RestController
@RequestMapping("/api/v1/view/measurements")
public class MeasurementController {

	@Autowired
	InsightsService insightsService;

	@GetMapping("/app/insights")
	public ResponseEntity<ApiResponseBody> getInsightsData(@RequestParam() @DateTimeFormat(pattern = dateTimeFormat) Date startDateTime,
														   @RequestParam() @DateTimeFormat(pattern = dateTimeFormat) Date endDateTime,
														   @RequestParam() String siteId) {
		List<String> siteIds = Arrays.stream(siteId.split(",")).toList();
		log.info("\nStart Time: {} \nEnd time: {} \nSites: {}\n", startDateTime, endDateTime, siteIds);
		List<Insight> insights = insightsService.getInsights(startDateTime, endDateTime, siteIds);

		ApiResponseBody apiResponseBody = new ApiResponseBody("Operation Successful", insights);
		return new ResponseEntity<>(apiResponseBody, new HttpHeaders(), HttpStatus.OK);
	}

	@GetMapping("/mobile-app/insights")
	public ResponseEntity<ApiResponseBody> getAppInsights(@RequestParam(required = false) @DateTimeFormat(pattern = dateTimeFormat) Date startDateTime,
														  @RequestParam(required = false) @DateTimeFormat(pattern = dateTimeFormat) Date endDateTime,
														  @RequestParam(required = false, defaultValue = "0") Integer utcOffset,
														  @RequestParam() String siteId) {

		if (startDateTime == null || endDateTime == null) {
			HashMap<String, Date> queryDates = Utils.getInsightsQueryDates();
			startDateTime = queryDates.get("startDateTime");
			endDateTime = queryDates.get("endDateTime");
		}

		InsightData insights = insightsService.getInsights(startDateTime, endDateTime, siteId, utcOffset);

		ApiResponseBody apiResponseBody = new ApiResponseBody("Operation Successful", insights);
		return new ResponseEntity<>(apiResponseBody, new HttpHeaders(), HttpStatus.OK);
	}

}
