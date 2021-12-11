package airqo.models;

import airqo.serializers.MeasurementSerializer;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
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

import static airqo.config.Constants.dateTimeFormat;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonSerialize(using = MeasurementSerializer.Serializer.class)
public class Measurement implements Serializable {


	private final String frequency = "raw";
	@Transient
	@JsonAlias("device_id")
	private String deviceId = "";
	@Field("_id")
	@JsonAlias("_id")
	@Id
	private String id = "";
	@DBRef
	@JsonAlias("deviceDetails")
	private Device device = new Device();
	@DBRef
	@JsonAlias("siteDetails")
	private Site site = new Site();
	@Indexed(direction = IndexDirection.DESCENDING, name = "Descending order")
	@JsonFormat(shape = JsonFormat.Shape.STRING, pattern = dateTimeFormat, timezone = "UTC")
	private Date time = new Date();

	@JsonAlias("hdop")
	private MeasurementValue hDop;

	private Location location;
	private MeasurementValue internalTemperature;
	private MeasurementValue internalHumidity;
	private MeasurementValue externalTemperature;
	private MeasurementValue externalHumidity;
	private MeasurementValue externalPressure;
	private MeasurementValue speed;
	private MeasurementValue altitude;
	private MeasurementValue pm1;
	private MeasurementValue pm10;
	private MeasurementValue pm2_5;
	private MeasurementValue no2;

	@Getter
	@Setter
	@AllArgsConstructor
	@NoArgsConstructor
	@ToString
	@JsonIgnoreProperties(ignoreUnknown = true)
	public static class MeasurementValue implements Serializable {
		Double value, calibratedValue, uncertaintyValue, standardDeviationValue;
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

}

