package airqo.models;

import airqo.serializers.WeatherSerializer;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.IndexDirection;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.io.Serializable;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Objects;

import static airqo.config.Constants.dateTimeFormat;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonSerialize(using = WeatherSerializer.Serializer.class)
@JsonDeserialize(using = WeatherSerializer.DeSerializer.class)
@Document(collection = "weather_measurements")
@CompoundIndexes({
	@CompoundIndex(name = "Weather Measurements Compound Index", def = "{'time' : 1, 'frequency': 1, 'site': 1}", unique = true)
})
public class Weather implements Serializable {

	@Id
	@Field("_id")
	@JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
	private String id;

	@DBRef
	@Indexed
	private Site site = new Site();

	@Indexed(direction = IndexDirection.DESCENDING, name = "Descending order")
	@JsonFormat(shape = JsonFormat.Shape.STRING, pattern = dateTimeFormat, timezone = "UTC")
	private Date time = new Date();

	private String frequency = "";
	private Double temperature;
	private Double humidity;
	private Double windSpeed;

	public Weather(Date time, String frequency, Double temperature, Double humidity, Double windSpeed) {
		this.time = time;
		this.frequency = frequency.toUpperCase();
		this.temperature = temperature;
		this.humidity = humidity;
		this.windSpeed = windSpeed;
	}

	public String getId() {
		return new WeatherId(time, frequency, site).toString();
	}

	public void setId(String id) {
		this.id = new WeatherId(time, frequency, site).toString();
	}

	@Override
	public boolean equals(Object obj) {
		if (obj == null || getClass() != obj.getClass()) return false;
		Weather objWeather = (Weather) obj;
		return id.equals(objWeather.id);
	}

	@Override
	public int hashCode() {
		return Objects.hash(time, frequency, site.getId());
	}


	@Getter
	@Setter
	@AllArgsConstructor
	@NoArgsConstructor
	public static class WeatherId implements Serializable {

		private final SimpleDateFormat simpleDateFormat = new SimpleDateFormat(dateTimeFormat);

		private Date time;
		private String frequency;
		private Site site;

		@Override
		public String toString() {
			String dateTime = simpleDateFormat.format(time).trim();
			String frequencyValue = frequency.trim();
			String siteId = site.getId().trim();
			return (siteId + ":" + frequencyValue + ":" + dateTime).toUpperCase();
		}

	}
}

