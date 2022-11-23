package airqo.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serial;
import java.io.Serializable;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class InsightData implements Serializable {
	@Serial
	private static final long serialVersionUID = 1L;
	private List<GraphInsight> forecast;
	private List<GraphInsight> historical;
}
