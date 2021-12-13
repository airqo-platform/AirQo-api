package airqo.services;

import airqo.models.Device;
import airqo.models.Tenant;
import airqo.repository.DeviceRepository;
import com.querydsl.core.types.Predicate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.util.MultiValueMap;

import java.util.List;

@Service
public class DeviceServiceImpl implements DeviceService {

	private static final Logger logger = LoggerFactory.getLogger(DeviceService.class);

	@Autowired
	DeviceRepository deviceRepository;

	@Override
	public Page<Device> getDevices(Predicate predicate, Pageable pageable) {
		return deviceRepository.findAll(predicate, pageable);
	}

	@Override
	public Device getDeviceByUniqueKey(String id, String deviceName) {
		return deviceRepository.getByIdOrName(id, deviceName);
	}

	@Override
	@Cacheable(value = "viewDevicesCache")
	public List<Device> getDevicesList(Predicate predicate) {
		return (List<Device>) deviceRepository.findAll(predicate);
	}

	@Override
	public List<Device> getDevices(Tenant tenant) {
		return deviceRepository.getAllByTenant(tenant.toString());
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
				logger.info(device.toString());
			}
		}
	}

	@Override
	public void insertDevice(Device device) {
		deviceRepository.save(device);
	}
}
