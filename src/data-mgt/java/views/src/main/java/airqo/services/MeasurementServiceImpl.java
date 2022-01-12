package airqo.services;

import airqo.models.*;
import airqo.repository.*;
import com.querydsl.core.types.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Slf4j
@Service
public class MeasurementServiceImpl implements MeasurementService {

	private final HourlyMeasurementRepository hourlyMeasurementRepository;
	private final DailyMeasurementRepository dailyMeasurementRepository;
	private final DeviceService deviceService;
	private final InsightRepository insightRepository;
	private final ForecastRepository forecastRepository;
	private final WeatherRepository weatherRepository;

	@Autowired
	public MeasurementServiceImpl(HourlyMeasurementRepository hourlyMeasurementRepository, DailyMeasurementRepository dailyMeasurementRepository, DeviceService deviceService, InsightRepository insightRepository, ForecastRepository forecastRepository, WeatherRepository weatherRepository) {
		this.hourlyMeasurementRepository = hourlyMeasurementRepository;
		this.dailyMeasurementRepository = dailyMeasurementRepository;
		this.deviceService = deviceService;
		this.insightRepository = insightRepository;
		this.forecastRepository = forecastRepository;
		this.weatherRepository = weatherRepository;
	}

	@Override
	@Cacheable(value = "viewInsightsCache", cacheNames = {"viewInsightsCache"}, unless = "#result.size() <= 0")
	public List<Insight> getInsights(Frequency frequency, Date startTime, Date endTime, String siteId) {
		QInsight qInsight = QInsight.insight;
		Predicate predicate = qInsight.frequency.equalsIgnoreCase(frequency.toString())
			.and(qInsight.siteId.equalsIgnoreCase(siteId))
			.and(qInsight.time.goe(startTime))
			.and(qInsight.time.loe(endTime));
		log.info(predicate.toString());
		return (List<Insight>) insightRepository.findAll(predicate);
	}

	@Override
	public List<Weather> getWeather(Frequency frequency, Date startTime, Date endTime, String siteId) {

		QWeather qWeather = QWeather.weather;
		Predicate predicate = qWeather.frequency.equalsIgnoreCase(frequency.toString())
			.and(qWeather.site.id.equalsIgnoreCase(siteId))
			.and(qWeather.time.goe(startTime))
			.and(qWeather.time.loe(endTime));
		log.info(predicate.toString());
		return (List<Weather>) weatherRepository.findAll(predicate);

	}

	@Override
	public void insertWeather(List<Weather> weather) {
		weatherRepository.saveAll(weather);
	}

	@Override
	public void insertWeather(Weather weather) {
		weatherRepository.save(weather);
	}

	@Override
	public List<Insight> getInsights(Date beforeTime, boolean forecast) {
		return insightRepository.findAllByTimeBeforeAndForecast(beforeTime, forecast);
	}

	@Override
	public void saveInsights(List<Insight> insights) {
		insightRepository.saveAll(insights);
	}

	@Override
	public void insertInsights(List<Insight> insights) {
		for (Insight insight : insights) {
			try {
				insightRepository.insert(insight);
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
	}

	@Override
	public List<Insight> insertAndCacheInsights(List<Insight> insights) {
		return insightRepository.saveAll(insights);
	}

	@Override
	public void insertInsight(Insight insight) {
		if (insight != null) {
			try {
				insightRepository.save(insight);
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
	}

	@Override
	public void deleteInsightsBefore(Date date) {
//		QInsight qInsight = QInsight.insight;
//		Predicate predicate = qInsight.time.loe(date);
//		List<Insight> insights = (List<Insight>) insightRepository.findAll(predicate);
		log.info(String.format("Deleting insights before %s", date));
		insightRepository.deleteAllByTimeBefore(date);
	}

	@Override
	public void insertForecast(List<Forecast> forecasts) {
		for (Forecast forecast : forecasts) {
			insertForecast(forecast);
		}
	}

	@Override
	public void insertForecast(Forecast forecast) {
		if (forecast != null) {
			try {
				forecastRepository.save(forecast);
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
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
	public List<HourlyMeasurement> getRecentHourlyMeasurements(Device device, Tenant tenant) {
		List<HourlyMeasurement> measurements = new ArrayList<>();
		if (device == null) {

			List<Device> devices = deviceService.getDevices(tenant);
			for (Device tenantDevice : devices) {
				HourlyMeasurement measurement = hourlyMeasurementRepository.findTopByDeviceOrderByTimeDesc(tenantDevice);
				if (measurement != null) {
					measurements.add(measurement);
				}
			}

		} else {
			HourlyMeasurement measurement = hourlyMeasurementRepository.findTopByDeviceOrderByTimeDesc(device);
			if (measurement != null) {
				measurements.add(measurement);
			}
		}
		return measurements;
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
	public void insertMeasurements(List<HourlyMeasurement> hourlyMeasurements,
								   List<DailyMeasurement> dailyMeasurements) {
		for (HourlyMeasurement hourlyMeasurement : hourlyMeasurements) {
			insertMeasurement(hourlyMeasurement, null);
		}

		for (DailyMeasurement dailyMeasurement : dailyMeasurements) {
			insertMeasurement(null, dailyMeasurement);
		}
	}

	@Override
	public void insertMeasurement(HourlyMeasurement hourlyMeasurement, DailyMeasurement dailyMeasurement) {

		if (hourlyMeasurement != null) {
			try {
				hourlyMeasurementRepository.save(hourlyMeasurement);
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
		if (dailyMeasurement != null) {
			try {
				dailyMeasurementRepository.save(dailyMeasurement);
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
	}
}
