package airqo.controllers;

import airqo.models.ApiResponseBody;
import airqo.models.StoreVersion;
import airqo.services.AppService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;


@Slf4j
@Profile({"api"})
@RestController
@RequestMapping(value={"/api/v1/view/mobile-app", "/api/v2/view/mobile-app"})
public class AppController {

	@Autowired
	AppService appService;

	@GetMapping("/version-info")
	public ResponseEntity<ApiResponseBody> getAppDetails(@RequestParam(defaultValue = "") String packageName, @RequestParam(defaultValue = "") String  bundleId, @RequestParam(defaultValue = "") String  version) {

		StoreVersion storeVersion;
		if (!packageName.isEmpty()){
			storeVersion = appService.getAndroidVersion(packageName, version);
		}
		else {
			storeVersion = appService.getIOSVersion(bundleId, version);
		}

		ApiResponseBody apiResponseBody = new ApiResponseBody("Operation Successful", storeVersion);
		return new ResponseEntity<>(apiResponseBody, new HttpHeaders(), HttpStatus.OK);
	}
}
