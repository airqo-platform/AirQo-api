package airqo.controllers;

import airqo.models.Device;
import airqo.services.DeviceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.querydsl.binding.QuerydslPredicate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("devices")
public class DeviceController {

    @Autowired
    DeviceService deviceService;

    @GetMapping("")
    public ResponseEntity<?> getDevices(
            @QuerydslPredicate(root = Device.class)
                    Pageable pageable) {
        Page<Device> devices = deviceService.getDevices(pageable);
        return new ResponseEntity<>(devices, new HttpHeaders(), HttpStatus.OK);
    }
}
