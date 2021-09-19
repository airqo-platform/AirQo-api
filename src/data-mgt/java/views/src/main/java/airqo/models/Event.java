package airqo.models;

import airqo.serializers.EventSerializer;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.format.annotation.DateTimeFormat;

import java.util.Date;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonSerialize(using = EventSerializer.Serializer.class)
@Document("events")
@CompoundIndexes({
	@CompoundIndex(name = "PM 2.5", def = "{'time' : 1, 'device_id': 1, 'pm2_5.value': 1}", unique = true)
})

public class Event {

	@Field("_id")
	@JsonAlias("_id")
	@Id
	private String id = "";

	@Field(value = "device_id")
	@JsonAlias("device_id")
	private String deviceId = "";

	@JsonAlias("site_id")
	private String siteId = "";

	@JsonAlias("device_number")
	private Integer deviceNumber = 0;

	@JsonAlias("hdop")
	private MeasurementValue hDop;

	@JsonAlias("s2_pm10")
	private MeasurementValue s2Pm10;

	@JsonAlias("s2_pm2_5")
	private MeasurementValue s2Pm2_5;

	@JsonAlias("average_pm10")
	private MeasurementValue averagePm10;

	@JsonAlias("average_pm2_5")
	private MeasurementValue averagePm2_5;

	//    @Indexed(direction = IndexDirection.DESCENDING, name =  "Descending order")
//    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'hh:mm:ss'Z'", timezone = "UTC")
	@DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
	private Date time = new Date();

	private String frequency = "";
	private String tenant = "";
	private String device = "";
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

	@Value
	public static class MeasurementValue {
		Double value, calibratedValue, uncertaintyValue, standardDeviationValue;
	}

	@Value
	public static class Location {
		Double latitude, longitude;
	}

}

