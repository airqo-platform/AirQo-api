package airqo.models;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.io.Serializable;
import java.util.Date;
import java.util.Objects;

import static airqo.config.Constants.dateTimeFormat;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
@Document(collection = "insights_measurements")
@CompoundIndexes({
	@CompoundIndex(name = "Insights Measurements Compound Index", def = "{'time' : 1, 'frequency': 1, 'siteId': 1}", unique = true)
})
public class Insight implements Serializable {

	@Id
	@Field("_id")
	@JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
	private InsightId id;

	@JsonFormat(shape = JsonFormat.Shape.STRING, pattern = dateTimeFormat, timezone = "UTC")
	private Date time;
	private double pm2_5;
	private double pm10;
	private Boolean isEmpty = false;
	private Boolean isForecast = false;
	private String name;
	private String location;
	private Frequency frequency;
	private String siteId;

	public Insight(Date time, double pm2_5, double pm10, Boolean isEmpty, Boolean isForecast, String name, String location, Frequency frequency, String siteId) {
		this.time = time;
		this.pm2_5 = pm2_5;
		this.pm10 = pm10;
		this.isEmpty = isEmpty;
		this.isForecast = isForecast;
		this.name = name;
		this.location = location;
		this.frequency = frequency;
		this.siteId = siteId;
		this.id = new InsightId(time, frequency, siteId);
	}

	@Override
	public boolean equals(Object obj) {
		if (obj == null || getClass() != obj.getClass()) return false;
		Insight objInsight = (Insight) obj;
		return id.equals(objInsight.id);
	}

	@Override
	public int hashCode() {
		return Objects.hash(time, frequency, siteId);
	}

	@Getter
	@Setter
	@AllArgsConstructor
	@NoArgsConstructor
	@ToString
	public static class InsightId implements Serializable {

		private Date time;
		private Frequency frequency;
		private String siteId;

		@Override
		public boolean equals(Object obj) {
			if (obj == null || getClass() != obj.getClass()) return false;
			InsightId objInsight = (InsightId) obj;
			return time.compareTo(objInsight.time) == 0 &&
				Objects.equals(frequency, objInsight.frequency) &&
				Objects.equals(siteId, objInsight.siteId);
		}

		@Override
		public int hashCode() {
			return Objects.hash(time, frequency, siteId);
		}
	}

}

