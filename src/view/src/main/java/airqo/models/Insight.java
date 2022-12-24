package airqo.models;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.format.annotation.DateTimeFormat;

import java.io.Serializable;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Objects;

import static airqo.config.Constants.dateTimeFormat;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class Insight implements Serializable {

	@Id
	@Field("_id")
	@JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
	private String id;

	@JsonFormat(shape = JsonFormat.Shape.STRING, pattern = dateTimeFormat, timezone = "UTC")
	@DateTimeFormat(pattern = dateTimeFormat)
	private Date time;
	private double pm2_5;
	private double pm10;
	private Boolean empty;
	private Boolean forecast;
	private Frequency frequency;
	private String siteId;

	@Transient
	@JsonFormat(shape = JsonFormat.Shape.STRING, pattern = dateTimeFormat, timezone = "UTC")
	@Getter(value = AccessLevel.PRIVATE)
	@DateTimeFormat(pattern = dateTimeFormat)
	@JsonIgnore
	private Date startDateTime;

	@Transient
	@JsonFormat(shape = JsonFormat.Shape.STRING, pattern = dateTimeFormat, timezone = "UTC")
	@Getter(value = AccessLevel.PRIVATE)
	@DateTimeFormat(pattern = dateTimeFormat)
	@JsonIgnore
	private Date endDateTime;

	public Insight setId() {
		this.id = new InsightId(time, frequency, siteId).toString();
		return this;
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
	public static class InsightId implements Serializable {

		private final SimpleDateFormat simpleDateFormat = new SimpleDateFormat(dateTimeFormat);

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
			return Objects.hash(siteId, frequency, time);
		}

		@Override
		public String toString() {
			String dateTime = simpleDateFormat.format(time).trim();
			return (siteId + ":" + frequency.toString() + ":" + dateTime).toUpperCase();
		}
	}

}

