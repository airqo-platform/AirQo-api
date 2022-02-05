package airqo.models;

import airqo.serializers.MeasurementSerializer;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.index.IndexDirection;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Field;

import java.io.Serializable;
import java.util.Date;
import java.util.List;
import java.util.Objects;

import static airqo.config.Constants.longDateTimeFormat;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonSerialize(using = MeasurementSerializer.Serializer.class)
public class Measurement implements Serializable {

	@Id
	@Field("_id")
	@JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
	private Measurement.MeasurementId id;

	@Transient
	@JsonAlias("device_id")
	private String deviceId = "";

	@DBRef
	@JsonAlias("deviceDetails")
	@JsonProperty("deviceDetails")
	private Device device = new Device();

	@Indexed(direction = IndexDirection.DESCENDING, name = "Descending order")
	@JsonFormat(shape = JsonFormat.Shape.STRING, pattern = longDateTimeFormat, timezone = "UTC")
	private Date time = new Date();

	@JsonAlias("hdop")
	private MeasurementValue hDop = new MeasurementValue();

	private String frequency = "";
	private Location location = new Location();
	private MeasurementValue internalTemperature = new MeasurementValue();
	private MeasurementValue internalHumidity = new MeasurementValue();
	private MeasurementValue externalTemperature = new MeasurementValue();
	private MeasurementValue externalHumidity = new MeasurementValue();
	private MeasurementValue externalPressure = new MeasurementValue();
	private MeasurementValue speed = new MeasurementValue();
	private MeasurementValue altitude = new MeasurementValue();
	private MeasurementValue pm1 = new MeasurementValue();
	private MeasurementValue pm10 = new MeasurementValue();
	private MeasurementValue pm2_5 = new MeasurementValue();
	private MeasurementValue no2 = new MeasurementValue();

	@Override
	public boolean equals(Object obj) {
		if (obj == null || getClass() != obj.getClass()) return false;
		Measurement objInsight = (Measurement) obj;
		return id.equals(objInsight.id);
	}

	@Override
	public int hashCode() {
		return Objects.hash(time, frequency, device.getId());
	}

	public Location getLocation() {
		if (location.latitude == null || location.longitude == null) {
			return new Location(device.getLatitude(), device.getLongitude());
		}
		return location;
	}

	public void setLocation(Location location) {
		if (location.latitude == null || location.longitude == null) {
			this.location = new Location(device.getLatitude(), device.getLongitude());
		} else {
			this.location = location;
		}
	}

	@Getter
	@Setter
	@AllArgsConstructor
	@NoArgsConstructor
	@ToString
	@JsonIgnoreProperties(ignoreUnknown = true)
	public static class MeasurementValue implements Serializable {
		Double value, calibratedValue, uncertaintyValue, standardDeviationValue;

		public Double getValue() {
			if (calibratedValue == null) {
				return value;
			}
			return calibratedValue;
		}
	}

	@Getter
	@Setter
	@AllArgsConstructor
	@NoArgsConstructor
	@ToString
	@JsonIgnoreProperties(ignoreUnknown = true)
	public static class Location implements Serializable {
		Double latitude, longitude;
	}

	@Getter
	@Setter
	@AllArgsConstructor
	@NoArgsConstructor
	@ToString
	@JsonIgnoreProperties(ignoreUnknown = true)
	public static class MeasurementsList implements Serializable {
		private List<Measurement> measurements;
	}

	@Getter
	@Setter
	@AllArgsConstructor
	@NoArgsConstructor
	@ToString
	public static class MeasurementId implements Serializable {

		private Date time;
		private String frequency;
		private String deviceId;

		@Override
		public boolean equals(Object obj) {
			if (obj == null || getClass() != obj.getClass()) return false;
			MeasurementId objInsight = (MeasurementId) obj;
			return time.compareTo(objInsight.time) == 0 &&
				Objects.equals(frequency, objInsight.frequency) &&
				Objects.equals(deviceId, objInsight.deviceId);
		}

		@Override
		public int hashCode() {
			return Objects.hash(time, frequency, deviceId);
		}
	}
}

