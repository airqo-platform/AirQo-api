package airqo.services.impl;

import airqo.models.Device;
import airqo.repository.DeviceRepository;
import airqo.services.DeviceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class DeviceServiceImpl implements DeviceService {

    @Autowired
    DeviceRepository deviceRepository;

    @Override
    public Page<Device> getDevices(Pageable pageable) {
        return deviceRepository.findAll(pageable);
    }

    @Override
    public void insertDevices(List<Device> events) {
        deviceRepository.saveAll(events);
    }
}
