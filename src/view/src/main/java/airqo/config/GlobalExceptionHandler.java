package airqo.config;

import airqo.models.ApiResponseBody;
import io.micrometer.core.instrument.config.validate.ValidationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.core.convert.ConversionFailedException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;

import javax.servlet.http.HttpServletRequest;
import java.text.ParseException;

@Slf4j
@Profile({"api"})
@ControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(CustomException.class)
	public ResponseEntity<ApiResponseBody> handleCustomException(HttpServletRequest request, Exception exception) {
		log.debug("CustomException {} {}", request.getRequestURI(), exception.getMessage());
		return ResponseEntity
			.status(HttpStatus.BAD_REQUEST)
			.body(new ApiResponseBody("Error", exception.getLocalizedMessage()));
	}

	@ExceptionHandler(NumberFormatException.class)
	public ResponseEntity<ApiResponseBody> handleNumberFormatException(HttpServletRequest request, Exception exception) {
		log.debug("NumberFormatException {} {}", request.getRequestURI(), exception.getMessage());
		return ResponseEntity
			.status(HttpStatus.BAD_REQUEST)
			.body(new ApiResponseBody("Invalid number format", exception.getLocalizedMessage()));
	}

	@ExceptionHandler(IllegalArgumentException.class)
	public ResponseEntity<ApiResponseBody> handleIllegalArgumentException(HttpServletRequest request, Exception exception) {
		log.debug("IllegalArgumentException {} {}", request.getRequestURI(), exception.getMessage());
		return ResponseEntity
			.status(HttpStatus.BAD_REQUEST)
			.body(new ApiResponseBody("Invalid Argument", exception.getLocalizedMessage()));
	}

	@ExceptionHandler(ConversionFailedException.class)
	public ResponseEntity<ApiResponseBody> handleConversionFailedException(HttpServletRequest request, Exception exception) {
		log.debug("ConversionFailedException {} {}", request.getRequestURI(), exception.getMessage());
		return ResponseEntity
			.status(HttpStatus.BAD_REQUEST)
			.body(new ApiResponseBody("Conversion error", exception.getLocalizedMessage()));
	}

	@ExceptionHandler(ParseException.class)
	public ResponseEntity<ApiResponseBody> handleParseException(HttpServletRequest request, Exception exception) {
		log.debug("ParseException {} {}", request.getRequestURI(), exception.getMessage());
		return ResponseEntity
			.status(HttpStatus.BAD_REQUEST)
			.body(new ApiResponseBody("Parsing error", exception.getLocalizedMessage()));
	}

	@ExceptionHandler(NoHandlerFoundException.class)
	@ResponseStatus(value = HttpStatus.NOT_FOUND)
	public ResponseEntity<ApiResponseBody> handleNotFoundError(HttpServletRequest request, NoHandlerFoundException ex) {
		log.debug("NotFoundError {} {}", request.getRequestURI(), ex.getMessage());
		return ResponseEntity
			.status(HttpStatus.BAD_REQUEST)
			.body(new ApiResponseBody("Path does not exists", ex.getLocalizedMessage()));
	}

	@ExceptionHandler(ValidationException.class)
	public ResponseEntity<ApiResponseBody> handleValidationException(HttpServletRequest request, ValidationException ex) {
		log.debug("ValidationException {} {}", request.getRequestURI(), ex.getMessage());
		return ResponseEntity
			.badRequest()
			.body(new ApiResponseBody("Validation exception", ex.getLocalizedMessage()));
	}

	@ExceptionHandler(MissingServletRequestParameterException.class)
	public ResponseEntity<ApiResponseBody> handleMissingServletRequestParameterException(HttpServletRequest request, MissingServletRequestParameterException ex) {
		log.debug("MissingServletRequestParameterException {} {}", request.getRequestURI(), ex.getMessage());
		return ResponseEntity
			.badRequest()
			.body(new ApiResponseBody("Missing request parameter", ex.getLocalizedMessage()));
	}

	@ExceptionHandler(MethodArgumentTypeMismatchException.class)
	public ResponseEntity<ApiResponseBody> handleMethodArgumentTypeMismatchException(HttpServletRequest request, MethodArgumentTypeMismatchException ex) {
		log.debug("handleMethodArgumentTypeMismatchException {}\n", request.getRequestURI(), ex);

		return ResponseEntity
			.badRequest()
			.body(new ApiResponseBody("Method argument type mismatch", ex.getLocalizedMessage()));
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ApiResponseBody> handleMethodArgumentNotValidException(HttpServletRequest request, MethodArgumentNotValidException ex) {
		log.debug("MethodArgumentNotValidException {}\n", request.getRequestURI(), ex);
		return ResponseEntity
			.badRequest()
			.body(new ApiResponseBody("Method argument validation failed", ex.getLocalizedMessage()));
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<ApiResponseBody> handleInternalServerError(HttpServletRequest request, Exception exception) {
		log.debug("InternalServerError {}", request.getRequestURI(), exception);
		return ResponseEntity
			.status(HttpStatus.INTERNAL_SERVER_ERROR)
			.body(new ApiResponseBody("Internal Server Error", null));
	}

}
