package airqo.controllers;

import airqo.config.GlobalExceptionHandler;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CustomErrorController implements ErrorController {

	@RequestMapping("/error")
	public ResponseEntity<GlobalExceptionHandler.ApiCallError> handleError() {
		return new ResponseEntity<>(new GlobalExceptionHandler.ApiCallError("Not Found", null),
			new HttpHeaders(), HttpStatus.NOT_FOUND);
	}
}
