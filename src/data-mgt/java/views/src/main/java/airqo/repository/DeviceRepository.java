package airqo.repository;

import airqo.models.Device;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.querydsl.QuerydslPredicateExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface DeviceRepository extends MongoRepository<Device, String>, QuerydslPredicateExecutor<Device> {
}
