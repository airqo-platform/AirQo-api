package airqo.models;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class StoreVersion {
	private String version = "";
	private String url = "";

	@JsonProperty(value = "is_updated")
	private Boolean isUpdated = false;
}
