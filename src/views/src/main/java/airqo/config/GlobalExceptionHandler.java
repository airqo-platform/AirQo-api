package airqo.config;

import airqo.models.ApiResponseBody;
import io.micrometer.core.instrument.config.validate.ValidationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static java.util.Optional.ofNullable;

@Profile({"api"})
@ControllerAdvice
public class GlobalExceptionHandler {

	final Logger logger = LoggerFactory.getLogger(getClass());

	@ExceptionHandler(NotFoundException.class)
	public ResponseEntity<ApiResponseBody> handleNotFoundException(HttpServletRequest request, Exception exception) {
		logger.error("{}", request.getRequestURI(), exception);
		logger.error("{}", List.of(exception.getMessage()));
		return ResponseEntity
			.status(HttpStatus.NOT_FOUND)
			.body(new ApiResponseBody("Not Found", null));
	}


	@ExceptionHandler(NumberFormatException.class)
	public ResponseEntity<ApiResponseBody> handleNumberFormatException(HttpServletRequest request, Exception exception) {
		logger.error("{}", request.getRequestURI(), exception);
		logger.error("{}", List.of(exception.getMessage()));
		return ResponseEntity
			.status(HttpStatus.BAD_REQUEST)
			.body(new ApiResponseBody("Invalid number format", exception.getMessage()));
	}

	@ExceptionHandler(IllegalArgumentException.class)
	public ResponseEntity<ApiResponseBody> handleIllegalArgumentException(HttpServletRequest request, Exception exception) {
		logger.error("{}", request.getRequestURI(), exception);
		logger.error("{}", List.of(exception.getMessage()));
		return ResponseEntity
			.status(HttpStatus.BAD_REQUEST)
			.body(new ApiResponseBody("Invalid Argument", exception.getLocalizedMessage()));
	}

	@ExceptionHandler(ConversionFailedException.class)
	public ResponseEntity<ApiResponseBody> handleConversionFailedException(HttpServletRequest request, Exception exception) {
		logger.error("{}", request.getRequestURI(), exception);
		logger.error("{}", List.of(exception.getMessage()));
		return ResponseEntity
			.status(HttpStatus.BAD_REQUEST)
			.body(new ApiResponseBody("Conversion error", exception.toString()));
	}

	@ExceptionHandler(ParseException.class)
	public ResponseEntity<ApiResponseBody> handleParseException(HttpServletRequest request, Exception exception) {
		logger.error("{}", request.getRequestURI(), exception);
		logger.error("{}", List.of(exception.getMessage()));
		return ResponseEntity
			.status(HttpStatus.BAD_REQUEST)
			.body(new ApiResponseBody("Parsing error", exception.getLocalizedMessage()));
	}

	@ExceptionHandler(NoHandlerFoundException.class)
	@ResponseStatus(value = HttpStatus.NOT_FOUND)
	public ResponseEntity<ApiResponseBody> handleNotFoundError(NoHandlerFoundException exception) {
		return ResponseEntity
			.status(HttpStatus.BAD_REQUEST)
			.body(new ApiResponseBody("Path does not exists", exception.getLocalizedMessage()));
	}

	@ExceptionHandler(ValidationException.class)
	public ResponseEntity<ApiResponseBody> handleValidationException(HttpServletRequest request, ValidationException ex) {
		logger.error("ValidationException {}\n", request.getRequestURI(), ex);
		logger.error("{}", List.of(ex.getMessage()));
		return ResponseEntity
			.badRequest()
			.body(new ApiResponseBody("Validation exception", ex.getMessage()));
	}

	@ExceptionHandler(MissingServletRequestParameterException.class)
	public ResponseEntity<ApiResponseBody> handleMissingServletRequestParameterException(HttpServletRequest request, MissingServletRequestParameterException ex) {
		return ResponseEntity
			.badRequest()
			.body(new ApiResponseBody("Missing request parameter", ex.getMessage()));
	}

	@ExceptionHandler(MethodArgumentTypeMismatchException.class)
	public ResponseEntity<ApiResponseBody> handleMethodArgumentTypeMismatchException(HttpServletRequest request, MethodArgumentTypeMismatchException ex) {
		logger.error("handleMethodArgumentTypeMismatchException {}\n", request.getRequestURI(), ex);

		Map<String, String> details = new HashMap<>();
		details.put("paramName", ex.getName());
		details.put("paramValue", ofNullable(ex.getValue()).map(Object::toString).orElse(""));

		return ResponseEntity
			.badRequest()
			.body(new ApiResponseBody("Method argument type mismatch", List.of(details)));
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ApiResponseBody> handleMethodArgumentNotValidException(HttpServletRequest request, MethodArgumentNotValidException ex) {
		logger.error("handleMethodArgumentNotValidException {}\n", request.getRequestURI(), ex);

		List<Map<String, String>> details = new ArrayList<>();
		ex.getBindingResult()
			.getFieldErrors()
			.forEach(fieldError -> {
				Map<String, String> detail = new HashMap<>();
				detail.put("objectName", fieldError.getObjectName());
				detail.put("field", fieldError.getField());
				detail.put("rejectedValue", "" + fieldError.getRejectedValue());
				detail.put("errorMessage", fieldError.getDefaultMessage());
				details.add(detail);
			});

		return ResponseEntity
			.badRequest()
			.body(new ApiResponseBody("Method argument validation failed", details));
	}


	@ExceptionHandler(Exception.class)
	public ResponseEntity<ApiResponseBody> handleInternalServerError(HttpServletRequest request, Exception exception) {
		logger.error("{}", request.getRequestURI(), exception);
		logger.error("{}", List.of(exception.getMessage()));
		return ResponseEntity
			.status(HttpStatus.INTERNAL_SERVER_ERROR)
			.body(new ApiResponseBody("Internal Server Error", null));
	}

}
