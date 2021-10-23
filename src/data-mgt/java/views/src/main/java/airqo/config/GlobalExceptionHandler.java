package airqo.config;

import io.micrometer.core.instrument.config.validate.ValidationException;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

@ControllerAdvice
public class GlobalExceptionHandler {

	Logger logger = LoggerFactory.getLogger(getClass());

	@ExceptionHandler(NotFoundException.class)
	public ResponseEntity<ApiCallError> handleNotFoundException(HttpServletRequest request, Exception exception) {
		logger.error("{}", request.getRequestURI(), exception);
		logger.error("{}", List.of(exception.getMessage()));
		return ResponseEntity
			.status(HttpStatus.NOT_FOUND)
			.body(new ApiCallError("Not Found", null));
	}


	@ExceptionHandler(NumberFormatException.class)
	public ResponseEntity<ApiCallError> handleNumberFormatException(HttpServletRequest request, Exception exception) {
		logger.error("{}", request.getRequestURI(), exception);
		logger.error("{}", List.of(exception.getMessage()));
		return ResponseEntity
			.status(HttpStatus.BAD_REQUEST)
			.body(new ApiCallError("Invalid number format", exception.getMessage()));
	}

	@ExceptionHandler(IllegalArgumentException.class)
	public ResponseEntity<ApiCallError> handleIllegalArgumentException(HttpServletRequest request, Exception exception) {
		logger.error("{}", request.getRequestURI(), exception);
		logger.error("{}", List.of(exception.getMessage()));
		return ResponseEntity
			.status(HttpStatus.BAD_REQUEST)
			.body(new ApiCallError("Invalid Argument", exception.getLocalizedMessage()));
	}

	@ExceptionHandler(ConversionFailedException.class)
	public ResponseEntity<ApiCallError> handleConversionFailedException(HttpServletRequest request, Exception exception) {
		logger.error("{}", request.getRequestURI(), exception);
		logger.error("{}", List.of(exception.getMessage()));
		return ResponseEntity
			.status(HttpStatus.BAD_REQUEST)
			.body(new ApiCallError("Conversion error", exception.toString()));
	}

	@ExceptionHandler(ParseException.class)
	public ResponseEntity<ApiCallError> handleParseException(HttpServletRequest request, Exception exception) {
		logger.error("{}", request.getRequestURI(), exception);
		logger.error("{}", List.of(exception.getMessage()));
		return ResponseEntity
			.status(HttpStatus.BAD_REQUEST)
			.body(new ApiCallError("Parsing error", exception.getLocalizedMessage()));
	}

	@ExceptionHandler(NoHandlerFoundException.class)
	@ResponseStatus(value = HttpStatus.NOT_FOUND)
	public String handleNotFoundError(NoHandlerFoundException ex) {
		return "path does not exists";
	}

	@ExceptionHandler(ValidationException.class)
	public ResponseEntity<ApiCallError> handleValidationException(HttpServletRequest request, ValidationException ex) {
		logger.error("ValidationException {}\n", request.getRequestURI(), ex);
		logger.error("{}", List.of(ex.getMessage()));
		return ResponseEntity
			.badRequest()
			.body(new ApiCallError("Validation exception", ex.getMessage()));
	}

	@ExceptionHandler(MissingServletRequestParameterException.class)
	public ResponseEntity<ApiCallError> handleMissingServletRequestParameterException(HttpServletRequest request, MissingServletRequestParameterException ex) {
		logger.error("handleMissingServletRequestParameterException {}\n", request.getRequestURI(), ex);
		logger.error("{}", ex.getMessage());
		return ResponseEntity
			.badRequest()
			.body(new ApiCallError("Missing request parameter", ex.getMessage()));
	}

	@ExceptionHandler(MethodArgumentTypeMismatchException.class)
	public ResponseEntity<ApiCallError> handleMethodArgumentTypeMismatchException(HttpServletRequest request, MethodArgumentTypeMismatchException ex) {
		logger.error("handleMethodArgumentTypeMismatchException {}\n", request.getRequestURI(), ex);

		Map<String, String> details = new HashMap<>();
		details.put("paramName", ex.getName());
		details.put("paramValue", ofNullable(ex.getValue()).map(Object::toString).orElse(""));
//        details.put("errorMessage", ex.getMessage());

		return ResponseEntity
			.badRequest()
			.body(new ApiCallError("Method argument type mismatch", List.of(details)));
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ApiCallError> handleMethodArgumentNotValidException(HttpServletRequest request, MethodArgumentNotValidException ex) {
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
			.body(new ApiCallError("Method argument validation failed", details));
	}


	@ExceptionHandler(Exception.class)
	public ResponseEntity<ApiCallError> handleInternalServerError(HttpServletRequest request, Exception exception) {
		logger.error("{}", request.getRequestURI(), exception);
		logger.error("{}", List.of(exception.getMessage()));
		return ResponseEntity
			.status(HttpStatus.INTERNAL_SERVER_ERROR)
			.body(new ApiCallError("Internal Server Error", null));
	}

	@AllArgsConstructor
	@NoArgsConstructor
	@Getter
	@Setter
	public static class ApiCallError {
		private String message;
		private Object data;
	}
}
