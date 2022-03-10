package airqo.services;

import airqo.models.Device;
import com.querydsl.core.types.Predicate;

import java.util.List;

public interface DeviceService {

	List<Device> getDevices(Predicate predicate);

	void saveDevices(List<Device> devices);

	void saveDevice(Device device);
}

