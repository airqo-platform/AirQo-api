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
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
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
	private String id;

	@JsonFormat(shape = JsonFormat.Shape.STRING, pattern = dateTimeFormat, timezone = "UTC")
	private Date time = new Date();
	private double pm2_5 = 0.0;
	private double pm10 = 0.0;
	private Boolean empty = false;
	private Boolean forecast = false;
	private String frequency = "";
	private String siteId = "";

	public Insight(Date time, double pm2_5, double pm10, Boolean empty, Boolean forecast, Frequency frequency, String siteId) {
		this.time = time;
		this.pm2_5 = pm2_5;
		this.pm10 = pm10;
		this.empty = empty;
		this.forecast = forecast;
		this.frequency = frequency.toString().toUpperCase();
		this.siteId = siteId;
		this.id = new InsightId(time, frequency.toString(), siteId).toString();
	}

	public void setId() {
		this.id = new InsightId(time, frequency, siteId).toString();
	}

	public String getFrequency() {
		return frequency.toUpperCase();
	}

	public void setFrequency(String frequency) {
		this.frequency = frequency.toUpperCase();
	}

	@Override
	public boolean equals(Object obj) {
		if (obj == null || getClass() != obj.getClass()) return false;
		Insight objInsight = (Insight) obj;
		return id.equals(objInsight.id);
	}

	@Override
	public int hashCode() {
		return Objects.hash(siteId, frequency, time);
	}

	@Getter
	@Setter
	@AllArgsConstructor
	@NoArgsConstructor
	@ToString
	public static class InsightId implements Serializable {

		private final SimpleDateFormat simpleDateFormat = new SimpleDateFormat(dateTimeFormat);

		private Date time;
		private String frequency;
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
			return Objects.hash(siteId, frequency, time);
		}

		@Override
		public String toString() {
			String dateTime = simpleDateFormat.format(time).trim();
			String frequencyValue = frequency.trim().toLowerCase();
			return (siteId + ":" + frequencyValue + ":" + dateTime).toUpperCase();
		}
	}

	@Getter
	@Setter
	@AllArgsConstructor
	@NoArgsConstructor
	@ToString
	public static class InsightMessage implements Serializable {

		private List<Insight> data = new ArrayList<>();
		private String action = "insert";
		private Date startTime = null;
		private Date endTime = null;

	}

}

