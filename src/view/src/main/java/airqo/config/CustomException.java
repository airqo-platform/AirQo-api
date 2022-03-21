package airqo.config;

import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@Profile({"api"})
@ResponseStatus(code = HttpStatus.BAD_REQUEST, reason = "Error")
public class CustomException extends RuntimeException {

	public CustomException(String exception) {
		super(exception);
	}

}
