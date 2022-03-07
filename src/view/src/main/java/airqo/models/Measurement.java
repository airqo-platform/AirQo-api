package airqo.models;

import airqo.serializers.MeasurementSerializer;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.IndexDirection;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.format.annotation.DateTimeFormat;

import java.io.Serializable;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Objects;

import static airqo.config.Constants.dateTimeFormat;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonSerialize(using = MeasurementSerializer.Serializer.class)
@Document(collection = "measurements")
@CompoundIndexes({
	@CompoundIndex(name = "Measurements Composite Key", def = "{'device.tenant': 1, 'device.id': 1, 'time' : 1, 'frequency': 1}", unique = true)
})
public class Measurement implements Serializable {

	@Id
	@Field("_id")
	@JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
	private String id;

	@Transient
	@JsonAlias("device_id")
	private String deviceId = "";

	@DBRef
	@JsonAlias("deviceDetails")
	@JsonProperty("deviceDetails")
	private Device device = new Device();

	@Indexed(direction = IndexDirection.DESCENDING, name = "Descending order")
	@JsonFormat(shape = JsonFormat.Shape.STRING, pattern = dateTimeFormat, timezone = "UTC")
	@DateTimeFormat(pattern = dateTimeFormat)
	private Date time = new Date();

	@JsonAlias("hdop")
	private MeasurementValue hDop = new MeasurementValue();

	@Indexed
	private Tenant tenant;

	private Frequency frequency;
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

	public String getId() {
		MeasurementId id = new MeasurementId();
		id.deviceId = deviceId;
		id.tenant = device.getTenant();
		id.time = time;
		id.frequency = frequency;
		return id.toString();
	}

	@Override
	public boolean equals(Object obj) {
		if (obj == null || getClass() != obj.getClass()) return false;
		Measurement objMeasurement = (Measurement) obj;
		return id.equals(objMeasurement.id);
	}

	@Override
	public int hashCode() {
		return Objects.hash(id);
	}

	public Location getLocation() {
		if (location.latitude == null || location.longitude == null) {
			return new Location(device.getLatitude(), device.getLongitude());
		}
		return location;
	}

	@Data
	@AllArgsConstructor
	@NoArgsConstructor
	@JsonIgnoreProperties(ignoreUnknown = true)
	public static class MeasurementValue implements Serializable {

		@Transient
		Double value;

		Double rawValue, calibratedValue;

		public Double getValue() {
			if (calibratedValue == null) {
				return rawValue;
			}
			return calibratedValue;
		}
	}

	@Data
	@AllArgsConstructor
	@NoArgsConstructor
	@JsonIgnoreProperties(ignoreUnknown = true)
	public static class Location implements Serializable {
		Double latitude, longitude;
	}

	public static class MeasurementId implements Serializable {

		private Tenant tenant;
		private String deviceId;
		private Date time;
		private Frequency frequency;

		@Override
		public boolean equals(Object obj) {
			if (obj == null || getClass() != obj.getClass()) return false;
			MeasurementId objMeasurementId = (MeasurementId) obj;
			return time.compareTo(objMeasurementId.time) == 0 &&
				Objects.equals(frequency, objMeasurementId.frequency) &&
				Objects.equals(deviceId, objMeasurementId.deviceId) &&
				Objects.equals(tenant, objMeasurementId.tenant);
		}

		@Override
		public String toString() {
			SimpleDateFormat simpleDateFormat = new SimpleDateFormat(dateTimeFormat);
			String str = tenant.toString() + ":" + deviceId + ':' + simpleDateFormat.format(time) + ":" + frequency.toString();
			return str.trim().toUpperCase();
		}

		@Override
		public int hashCode() {
			return Objects.hash(time, frequency, deviceId, tenant);
		}
	}

}

