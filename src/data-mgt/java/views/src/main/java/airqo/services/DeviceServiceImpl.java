package airqo.services;

import airqo.models.Device;
import airqo.models.Tenant;
import airqo.repository.DeviceRepository;
import com.querydsl.core.types.Predicate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.util.MultiValueMap;

import java.util.List;

@Service
public class DeviceServiceImpl implements DeviceService {

	@Autowired
	DeviceRepository deviceRepository;

	@Override
	public Page<Device> getDevices(Predicate predicate, Pageable pageable) {
		return deviceRepository.findAll(predicate, pageable);
	}

	@Cacheable(value = "devicesCache")
	@Override
	public List<Device> getDevicesList(Predicate predicate) {
		return (List<Device>) deviceRepository.findAll(predicate);
	}

	@Override
	public Page<Device> getDevices(Predicate predicate, Pageable pageable, MultiValueMap<String, String> parameters) {
		return null;
	}

	@Override
	public void insertDevices(List<Device> devices, Tenant tenant) {
		for (Device device : devices) {

			try {
				if (tenant != null) {
					device.setTenant(tenant.toString());
				}
				insertDevice(device);
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
	}

	@Override
	public void insertDevice(Device device) {
		deviceRepository.save(device);
	}
}
