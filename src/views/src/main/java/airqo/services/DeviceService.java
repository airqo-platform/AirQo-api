package airqo.services;

import airqo.models.Device;
import airqo.models.Tenant;
import com.querydsl.core.types.Predicate;

import java.util.List;

public interface DeviceService {

	List<Device> getDevices(Predicate predicate);

	void insertDevices(List<Device> devices, Tenant tenant);

	void insertDevice(Device device);
}

