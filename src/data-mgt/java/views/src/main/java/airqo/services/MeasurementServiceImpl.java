package airqo.services;

import airqo.models.HourlyMeasurement;
import airqo.models.RawMeasurement;
import airqo.repository.HourlyMeasurementRepository;
import airqo.repository.RawMeasurementRepository;
import com.querydsl.core.types.Predicate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.util.MultiValueMap;

import java.util.List;

@Service
public class MeasurementServiceImpl implements MeasurementService {

	@Autowired
	HourlyMeasurementRepository hourlyMeasurementRepository;

	@Autowired
	RawMeasurementRepository rawMeasurementRepository;

	@Override
	public Page<RawMeasurement> getRawMeasurements(Pageable pageable, MultiValueMap<String, String> parameters) {

		return rawMeasurementRepository.findAll(pageable);
	}

	@Override
	public Page<RawMeasurement> getRawMeasurements(Pageable pageable, Predicate predicate) {
		return rawMeasurementRepository.findAll(predicate, pageable);
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
