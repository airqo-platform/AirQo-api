package airqo.services;

import airqo.models.Device;
import com.querydsl.core.types.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface DeviceService {
	Page<Device> getDevices(Predicate predicate, Pageable pageable);

	void insertDevices(List<Device> devices);
}
