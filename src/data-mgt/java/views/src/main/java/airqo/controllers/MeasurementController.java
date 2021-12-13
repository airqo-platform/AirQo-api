package airqo.controllers;

import airqo.models.*;
import airqo.services.DeviceService;
import airqo.services.MeasurementService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
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

@Profile({"api"})
@RestController
@RequestMapping("measurements")
public class MeasurementController {

	private static final Logger logger = LoggerFactory.getLogger(MeasurementController.class);
	final SimpleDateFormat simpleDateFormat = new SimpleDateFormat(dateTimeFormat);

	@Autowired
	MeasurementService measurementService;

	@Autowired
	DeviceService deviceService;

	@GetMapping("")
	public ResponseEntity<?> getMeasurements(
		@PageableDefault(sort = "time") Pageable pageable,
		@RequestParam MultiValueMap<String, String> parameters
	) {
		logger.info(String.valueOf(parameters));
		Page<RawMeasurement> measurements = measurementService.getRawMeasurements(pageable, parameters);
		return new ResponseEntity<>(measurements, new HttpHeaders(), HttpStatus.OK);
	}


	@GetMapping("/forecast")
	public ResponseEntity<ApiResponseBody> getForecast(
		@RequestParam String startTime,
		@RequestParam String deviceName
	) {

		Date startDateTime;

		try {
			startDateTime = simpleDateFormat.parse(startTime);
		} catch (ParseException e) {
			e.printStackTrace();
			ApiResponseBody httpResponseBody = new ApiResponseBody(null, "Invalid DateTime");
			return new ResponseEntity<>(httpResponseBody, new HttpHeaders(), HttpStatus.BAD_REQUEST);
		}

		Device device;
		try {
			device = deviceService.getDeviceByUniqueKey(null, deviceName);
			if (device == null) {
				throw new Exception("Device doesnt exist");
			}
		} catch (Exception e) {
			e.printStackTrace();
			ApiResponseBody httpResponseBody = new ApiResponseBody(null, "Device doesnt exist");
			return new ResponseEntity<>(httpResponseBody, new HttpHeaders(), HttpStatus.NOT_FOUND);
		}

		List<Forecast> forecasts = measurementService.getForecasts(startDateTime, device);

		ApiResponseBody apiResponseBody = new ApiResponseBody("Operation Successful", forecasts);
		return new ResponseEntity<>(apiResponseBody, new HttpHeaders(), HttpStatus.OK);
	}


	@GetMapping("/insights")
	public ResponseEntity<ApiResponseBody> getAppInsights(
		@RequestParam(defaultValue = "undefined") String frequency,
		@RequestParam(defaultValue = "airqo") String tenant,
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

		List<Insight> insights = measurementService
			.getInsights(queryFrequency, startDateTime, endDateTime, tenant, siteId);

		ApiResponseBody apiResponseBody = new ApiResponseBody("Operation Successful", insights);
		return new ResponseEntity<>(apiResponseBody, new HttpHeaders(), HttpStatus.OK);
	}

}
