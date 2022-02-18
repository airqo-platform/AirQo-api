package airqo.controllers;

import airqo.models.Device;
import airqo.repository.DeviceRepository;
import airqo.services.DeviceService;
import com.querydsl.core.types.Predicate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.data.querydsl.binding.QuerydslPredicate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Profile({"api"})
@RestController
@RequestMapping("devices")
public class DeviceController {

	private final DeviceService deviceService;

	@Autowired
	public DeviceController(DeviceService deviceService) {
		this.deviceService = deviceService;
	}

	@GetMapping("")
	public ResponseEntity<?> getDevices(
		@QuerydslPredicate(root = Device.class, bindings = DeviceRepository.class) Predicate predicate) {

		List<Device> devices = deviceService.getDevices(predicate);
		return new ResponseEntity<>(devices, new HttpHeaders(), HttpStatus.OK);
	}

}
