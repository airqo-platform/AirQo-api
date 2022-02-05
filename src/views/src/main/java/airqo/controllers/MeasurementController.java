package airqo.controllers;

import airqo.models.*;
import airqo.services.MeasurementService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;

import static airqo.config.Constants.dateTimeFormat;

@Slf4j
@Profile({"api"})
@RestController
@RequestMapping("measurements")
public class MeasurementController {

	private final SimpleDateFormat simpleDateFormat = new SimpleDateFormat(dateTimeFormat);
	private final MeasurementService measurementService;

	@Autowired
	public MeasurementController(MeasurementService measurementService) {
		this.measurementService = measurementService;
	}

	@GetMapping("")
	public ResponseEntity<?> getMeasurements(
		@RequestParam MultiValueMap<String, Object> parameters
	) {

		if (parameters.containsKey("recent")) {
			List<HourlyMeasurement> measurements = measurementService.getRecentHourlyMeasurements(null, null);

			ApiResponseBody httpResponseBody = new ApiResponseBody("Operation Successful", measurements);
			return new ResponseEntity<>(httpResponseBody, new HttpHeaders(), HttpStatus.OK);
		}
		log.info(String.valueOf(parameters));
		List<HourlyMeasurement> measurements = measurementService.getRecentHourlyMeasurements(null, null);
		return new ResponseEntity<>(measurements, new HttpHeaders(), HttpStatus.OK);
	}

	@GetMapping("/insights")
	public ResponseEntity<ApiResponseBody> getAppInsights(
		@RequestParam(defaultValue = "hourly", required = false) String frequency,
		@RequestParam String startTime,
		@RequestParam String endTime,
		@RequestParam String siteId
	) {

		Date startDateTime;
		Date endDateTime;
		try {
			startDateTime = simpleDateFormat.parse(startTime);
			endDateTime = simpleDateFormat.parse(endTime);
		} catch (ParseException e) {
			e.printStackTrace();
			ApiResponseBody httpResponseBody = new ApiResponseBody(null, "Invalid DateTime");
			return new ResponseEntity<>(httpResponseBody, new HttpHeaders(), HttpStatus.BAD_REQUEST);
		}

		if (startDateTime.after(endDateTime)) {
			ApiResponseBody httpResponseBody = new ApiResponseBody(null, "Start Time must be a date before the end time");
			return new ResponseEntity<>(httpResponseBody, new HttpHeaders(), HttpStatus.BAD_REQUEST);
		}

		Frequency queryFrequency;
		switch (frequency.toLowerCase()) {
			case "hourly":
				queryFrequency = Frequency.HOURLY;
				break;
			case "daily":
				queryFrequency = Frequency.DAILY;
				break;
			default:
				ApiResponseBody httpResponseBody = new ApiResponseBody("Invalid Frequency", null);
				return new ResponseEntity<>(httpResponseBody, new HttpHeaders(), HttpStatus.BAD_REQUEST);
		}
		List<String> siteIds = List.of(siteId.split(","));
		List<Insight> insights = measurementService.getInsights(queryFrequency, startDateTime, endDateTime, siteIds);
		ApiResponseBody apiResponseBody = new ApiResponseBody("Operation Successful", insights);
		return new ResponseEntity<>(apiResponseBody, new HttpHeaders(), HttpStatus.OK);
	}

}
