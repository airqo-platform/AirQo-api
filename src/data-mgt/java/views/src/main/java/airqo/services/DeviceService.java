package airqo.services;

import airqo.models.Device;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface DeviceService {
    Page<Device> getDevices(Pageable pageable);

    void insertDevices(List<Device> devices);
}
