package airqo.services;

import airqo.models.*;
import airqo.repository.*;
import com.querydsl.core.types.Predicate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.util.MultiValueMap;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Service
public class MeasurementServiceImpl implements MeasurementService {

	private static final Logger logger = LoggerFactory.getLogger(MeasurementService.class);

	@Autowired
	HourlyMeasurementRepository hourlyMeasurementRepository;

	@Autowired
	DailyMeasurementRepository dailyMeasurementRepository;

	@Autowired
	DeviceService deviceService;

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
	public List<Insight> getInsights(Frequency frequency, Date startTime, Date endTime, String tenant, String siteId) {
		QInsight qInsight = new QInsight("frequency");
		Predicate predicate = qInsight.frequency.eq(frequency.toString())
			.and(qInsight.siteId.eq(siteId))
			.and(
				qInsight.time.between(startTime, endTime).or(qInsight.time.eq(startTime)).or(qInsight.time.eq(endTime))
			);
		return (List<Insight>) insightRepository.findAll(predicate);
	}

	@Override
	public void insertInsights(List<Insight> insights) {
		logger.info("inserting insights");
		insightRepository.saveAll(insights);
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
	public List<HourlyMeasurement> getHourlyMeasurements(@Nullable Device device, @NonNull Date startTime, @NonNull Tenant tenant) {
		if (device == null) {

			List<Device> devices = deviceService.getDevices(tenant);
			List<HourlyMeasurement> measurements = new ArrayList<>();

			for (Device tenantDevice : devices) {
				QHourlyMeasurement qHourlyMeasurement = new QHourlyMeasurement("device");
				Predicate predicate = qHourlyMeasurement.time.eq(startTime).or(qHourlyMeasurement.time.after(startTime)).and(qHourlyMeasurement.device.id.eq(tenantDevice.getId()));

				List<HourlyMeasurement> deviceMeasurements = (List<HourlyMeasurement>) hourlyMeasurementRepository.findAll(predicate);
				measurements.addAll(deviceMeasurements);
			}
			return measurements;

		} else {
			return hourlyMeasurementRepository.findAllByDeviceAndTimeGreaterThanEqual(device, startTime);
		}
	}

	@Override
	public List<DailyMeasurement> getDailyMeasurements(Device device, @NonNull Date startTime, @NonNull Tenant tenant) {
		if (device == null) {

			List<Device> devices = deviceService.getDevices(tenant);
			List<DailyMeasurement> measurements = new ArrayList<>();

			for (Device tenantDevice : devices) {
				QDailyMeasurement qDailyMeasurement = new QDailyMeasurement("device");
				Predicate predicate = qDailyMeasurement.time.eq(startTime).or(qDailyMeasurement.time.after(startTime)).and(qDailyMeasurement.device.id.eq(tenantDevice.getId()));

				List<DailyMeasurement> deviceMeasurements = (List<DailyMeasurement>) dailyMeasurementRepository.findAll(predicate);
				measurements.addAll(deviceMeasurements);
			}
			return measurements;

		} else {
			return dailyMeasurementRepository.findAllByDeviceAndTimeGreaterThanEqual(device, startTime);
		}
	}

	@Override
	public void insertMeasurements(List<RawMeasurement> rawMeasurements, List<HourlyMeasurement> hourlyMeasurements,
								   List<DailyMeasurement> dailyMeasurements) {
		hourlyMeasurementRepository.saveAll(hourlyMeasurements);
		rawMeasurementRepository.saveAll(rawMeasurements);
		dailyMeasurementRepository.saveAll(dailyMeasurements);
	}
}
