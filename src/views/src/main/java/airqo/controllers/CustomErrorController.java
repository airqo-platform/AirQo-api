package airqo.controllers;

import airqo.models.ApiResponseBody;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Profile({"api"})
@RestController
public class CustomErrorController implements ErrorController {

	@RequestMapping("/error")
	public ResponseEntity<ApiResponseBody> handleError() {
		return new ResponseEntity<>(new ApiResponseBody("Not Found", null),
			new HttpHeaders(), HttpStatus.NOT_FOUND);
	}
}
