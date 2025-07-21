package airqo.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

@Getter
@Setter
@NoArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class ApiResponseBody {
	private String message;
	private Object data;

	public ApiResponseBody(String message, Object data) {
		this.message = message;
		this.data = data;
	}
}
