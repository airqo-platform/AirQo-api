package airqo.models;

import airqo.serializers.Views;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonView;
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

	@JsonView(Views.GraphInsightView.class)
	private String message;

	@JsonView(Views.GraphInsightView.class)
	private Object data;

	public ApiResponseBody(String message, Object data) {
		this.message = message;
		this.data = data;
	}
}
