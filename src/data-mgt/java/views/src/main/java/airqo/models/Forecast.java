package airqo.models;

import airqo.serializers.ForecastSerializer;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import lombok.*;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.IndexDirection;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
@Document(collection = "forecast_measurements")
@CompoundIndexes({
	@CompoundIndex(name = "Forecast Measurement Composite Index", def = "{'time' : 1, 'device': 1}", unique = true)
})
public class Forecast implements Serializable {

	@DBRef
	private Device device = new Device();

	@JsonAlias("prediction_time")
	@Indexed(direction = IndexDirection.DESCENDING, name = "Descending order")
	@JsonSerialize(using = ForecastSerializer.ForecastDateSerializer.class)
	@JsonDeserialize(using = ForecastSerializer.ForecastDateDeserializer.class)
	private Date time = new Date();

	@JsonAlias("prediction_value")
	private Double pm2_5;

	@JsonAlias("lower_ci")
	private Double lowerConfidenceInterval;

	@JsonAlias("upper_ci")
	private Double upperConfidenceInterval;


	@Getter
	@Setter
	@AllArgsConstructor
	@NoArgsConstructor
	@ToString
	@JsonIgnoreProperties(ignoreUnknown = true)
	public static class Forecasts {
		List<Forecast> predictions;

		public static List<Forecast> refactorRecords(List<Forecast> forecasts, Device device) {
			forecasts.removeIf(forecast ->
				forecast.pm2_5 == null || forecast.pm2_5.isNaN() || forecast.pm2_5 == 0);
			List<Forecast> cleanedData = new ArrayList<>();
			for (Forecast forecast : forecasts) {
				forecast.device = device;
				cleanedData.add(forecast);
			}
			return cleanedData;
		}
	}

}

