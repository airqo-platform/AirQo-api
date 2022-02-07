package airqo.services;

import airqo.models.*;
import airqo.repository.HourlyMeasurementRepository;
import airqo.repository.InsightRepository;
import com.querydsl.core.types.Predicate;
import io.sentry.spring.tracing.SentrySpan;
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
	private final DeviceService deviceService;
	private final InsightRepository insightRepository;

	@Autowired
	public MeasurementServiceImpl(HourlyMeasurementRepository hourlyMeasurementRepository, DeviceService deviceService, InsightRepository insightRepository) {
		this.hourlyMeasurementRepository = hourlyMeasurementRepository;
		this.deviceService = deviceService;
		this.insightRepository = insightRepository;
	}

	@Override
	@SentrySpan
	@Cacheable(value = "insightsCache", cacheNames = {"insightsCache"}, unless = "#result.size() <= 0")
	public List<Insight> getInsights(Frequency frequency, Date startTime, Date endTime, List<String> siteIds) {

		QInsight qInsight = QInsight.insight;
		Predicate predicate = qInsight.frequency.equalsIgnoreCase(frequency.toString())
			.and(qInsight.siteId.in(siteIds))
			.and(qInsight.time.goe(startTime))
			.and(qInsight.time.loe(endTime));
		log.info(predicate.toString());
		return (List<Insight>) insightRepository.findAll(predicate);

//		return insightRepository.findAllByFrequencyAndSiteIdInAndTimeBetween(
//			frequency.toString().toUpperCase(), siteIds, startTime, endTime);
	}

	@Override
	public List<Insight> getInsightsBefore(Date beforeTime) {
		return insightRepository.findAllByTimeBefore(beforeTime);
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
				log.info(e.toString());
			}
		}
	}

	@Override
	public List<Insight> insertAndCacheInsights(List<Insight> insights) {
		return insightRepository.saveAll(insights);
	}

	@Override
	public void deleteInsightsBefore(Date date) {
		log.info(String.format("Deleting insights before %s", date));
		insightRepository.deleteAllByTimeBefore(date);
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
	public void insertMeasurements(List<HourlyMeasurement> hourlyMeasurements) {
		for (HourlyMeasurement hourlyMeasurement : hourlyMeasurements) {
			insertMeasurement(hourlyMeasurement);
		}
	}

	@Override
	public void insertMeasurement(HourlyMeasurement hourlyMeasurement) {

		if (hourlyMeasurement != null) {
			try {
				hourlyMeasurementRepository.save(hourlyMeasurement);
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
	}
}
