package airqo.services;

import airqo.models.Device;
import airqo.models.Tenant;
import com.querydsl.core.types.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.lang.Nullable;
import org.springframework.util.MultiValueMap;

import java.util.List;

public interface DeviceService {
	Page<Device> getDevices(Predicate predicate, Pageable pageable);

	Device getDeviceByUniqueKey(String id, String deviceName);

	List<Device> getDevicesList(Predicate predicate);

	List<Device> getDevices(@Nullable Tenant tenant);

	Page<Device> getDevices(Predicate predicate, Pageable pageable, MultiValueMap<String, String> parameters);

	void insertDevices(List<Device> devices, Tenant tenant);

	void insertDevice(Device device);
}

