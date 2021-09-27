package airqo.services;

import airqo.models.Device;
import airqo.models.Tenant;
import com.querydsl.core.types.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.util.MultiValueMap;

import java.util.List;

public interface DeviceService {
	Page<Device> getDevices(Predicate predicate, Pageable pageable);

	Page<Device> getDevices(Predicate predicate, Pageable pageable, MultiValueMap<String, String> parameters);

	void insertDevices(List<Device> devices, Tenant tenant);

	void insertDevice(Device device);
}

