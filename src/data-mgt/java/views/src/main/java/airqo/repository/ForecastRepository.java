package airqo.repository;

import airqo.models.Device;
import airqo.models.Forecast;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Date;
import java.util.List;

@Repository
public interface ForecastRepository extends MongoRepository<Forecast, String> {

	List<Forecast> findAllByTimeGreaterThanEqual(Date startTime);

	List<Forecast> findAllByDeviceAndTimeGreaterThanEqual(Device device, Date startTime);
}
