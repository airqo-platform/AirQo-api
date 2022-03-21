package airqo.services;

import airqo.models.Device;
import airqo.repository.DeviceRepository;
import com.querydsl.core.types.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
public class DeviceServiceImpl implements DeviceService {

	private final DeviceRepository deviceRepository;

	@Autowired
	public DeviceServiceImpl(DeviceRepository deviceRepository) {
		this.deviceRepository = deviceRepository;
	}

	@Override
	public List<Device> getDevices(Predicate predicate) {
		return (List<Device>) deviceRepository.findAll(predicate);
	}


	@Override
	public void saveDevices(List<Device> devices) {
		for (Device device : devices) {
			try {
				saveDevice(device);
			} catch (Exception e) {
				e.printStackTrace();
				log.info(device.toString());
			}
		}
	}

	@Override
	public void saveDevice(Device device) {
		deviceRepository.save(device);
	}
}
