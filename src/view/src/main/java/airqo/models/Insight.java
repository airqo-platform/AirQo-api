package airqo.models;

import airqo.serializers.Views;
import com.fasterxml.jackson.annotation.*;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;
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
@Document(collection = "insights_measurements")
@CompoundIndexes({
	@CompoundIndex(name = "Insights Measurements Compound Index", def = "{'time' : 1, 'frequency': 1, 'siteId': 1}", unique = true),
	@CompoundIndex(name = "Latest Insights Compound Index", def = "{'time' : 1, 'frequency': 1, 'empty': 1}")
})
public class Insight implements Serializable {

	@Id
	@Field("_id")
	@JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
	private String id;

	@JsonView(Views.InsightView.class)
	@JsonFormat(shape = JsonFormat.Shape.STRING, pattern = dateTimeFormat, timezone = "UTC")
	@DateTimeFormat(pattern = dateTimeFormat)
	private Date time;

	@JsonView(Views.InsightView.class)
	private double pm2_5;

	@JsonView(Views.InsightView.class)
	private double pm10;

	@JsonView(Views.InsightView.class)
	private String siteId;

	@JsonView(Views.GraphInsightView.class)
	private Boolean empty;

	@JsonView(Views.GraphInsightView.class)
	private Boolean forecast;

	@JsonView(Views.GraphInsightView.class)
	private Frequency frequency;

	@JsonView(Views.LatestInsightView.class)
	private String name;

	@JsonView(Views.LatestInsightView.class)
	private String location;

	@JsonView(Views.LatestInsightView.class)
	private double latitude;

	@JsonView(Views.LatestInsightView.class)
	private double longitude;

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

