package airqo.services;

import airqo.models.*;
import airqo.repository.ForecastRepository;
import airqo.repository.HourlyMeasurementRepository;
import airqo.repository.InsightRepository;
import airqo.repository.RawMeasurementRepository;
import com.querydsl.core.types.Predicate;
import org.apache.commons.lang3.time.DateUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.util.MultiValueMap;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import static airqo.utils.HelperMethods.getRandomValue;

@Service
public class MeasurementServiceImpl implements MeasurementService {

	private static final Logger logger = LoggerFactory.getLogger(MeasurementService.class);

	@Autowired
	HourlyMeasurementRepository hourlyMeasurementRepository;

	@Autowired
	RawMeasurementRepository rawMeasurementRepository;

	@Autowired
	InsightRepository insightRepository;

	@Autowired
	ForecastRepository forecastRepository;

	@Override
	public Page<RawMeasurement> getRawMeasurements(Pageable pageable, MultiValueMap<String, String> parameters) {
		return rawMeasurementRepository.findAll(pageable);
	}

	@Override
	public Page<RawMeasurement> getRawMeasurements(Pageable pageable, Predicate predicate) {
		return rawMeasurementRepository.findAll(predicate, pageable);

	}

	@Override
	public List<Insight> getAppInsights(String frequency, Date startTime, Date endTime, String tenant, String siteId) {

		List<Insight> insights = new ArrayList<>();
		insights.add(new Insight(startTime, getRandomValue(500.0), getRandomValue(500.0), false,
			false, "Kira", "kampala Uganda", frequency, siteId));

		if (frequency.equalsIgnoreCase("undefined")) {
			Date start = startTime;
			while (start.before(endTime)) {
				start = DateUtils.addDays(start, 1);
				insights.add(new Insight(start, getRandomValue(500.0), getRandomValue(500.0), false,
					false, "Kira", "kampala Uganda", "daily", siteId));
			}
			start = startTime;
			while (start.before(endTime)) {
				start = DateUtils.addHours(start, 1);
				insights.add(new Insight(start, getRandomValue(500.0), getRandomValue(500.0), false,
					false, "Kira", "kampala Uganda", "hourly", siteId));
			}
		} else {
			while (startTime.before(endTime)) {

				if (frequency.equalsIgnoreCase("daily")) {
					startTime = DateUtils.addDays(startTime, 1);
				} else {
					startTime = DateUtils.addHours(startTime, 1);
				}

				insights.add(new Insight(startTime, getRandomValue(500.0), getRandomValue(500.0), false, false,
					"Kira", "kampala Uganda", frequency, siteId));
			}
		}

		return insights;
	}

	@Override
	public List<Insight> getInsights(String frequency, Date startTime, Date endTime, String tenant, String siteId) {
//		return insightRepository.getAllByFrequencyAndSiteIdAndTimeBetween(frequency, siteId, startTime, endTime);
		return insightRepository.findAll();
	}

	@Override
	public void insertInsights(List<Insight> insights, boolean replace) {
		logger.info("inserting insights");
		logger.info(insights.toString());
		for (Insight insight : insights) {
			Insight saved = insightRepository.save(insight);
			logger.info(saved.getId());
		}

	}

	@Override
	public void deleteInsightsBefore(Date startTime) {
		insightRepository.deleteAllByTimeBefore(startTime);
	}

	@Override
	public void insertForecast(List<Forecast> forecasts) {
		forecastRepository.saveAll(forecasts);
	}

	@Override
	public List<Forecast> getForecasts(Date startTime, Device device) {
		if (device == null) {
			return forecastRepository.findAllByTimeGreaterThanEqual(startTime);
		} else {
			return forecastRepository.findAllByDeviceAndTimeGreaterThanEqual(device, startTime);
		}
	}

	@Override
	public Page<HourlyMeasurement> getHourlyMeasurements(Pageable pageable, Predicate predicate) {
		return hourlyMeasurementRepository.findAll(predicate, pageable);
	}

	@Override
	public void insertMeasurements(List<RawMeasurement> rawMeasurements, List<HourlyMeasurement> hourlyMeasurements) {
		hourlyMeasurementRepository.saveAll(hourlyMeasurements);
		rawMeasurementRepository.saveAll(rawMeasurements);
	}
}
