package airqo.serializers;

import airqo.models.Device;
import airqo.models.Measurement;
import airqo.models.Site;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializerProvider;
import org.springframework.boot.jackson.JsonComponent;

import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.HashMap;
import java.util.Map;
import java.util.TimeZone;

@JsonComponent
public class MeasurementSerializer {

	public static class Serializer extends JsonSerializer<Measurement> {

		@Override
		public void serialize(Measurement measurement, JsonGenerator jGen, SerializerProvider serializerProvider) throws IOException {

			SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
			simpleDateFormat.setTimeZone(TimeZone.getTimeZone("UTC"));

			ObjectMapper mapper = new ObjectMapper();
			Site.SiteView siteView = mapper
				.readValue(mapper.writeValueAsString(measurement.getDevice().getSite()), Site.SiteView.class);

			Device.DeviceView deviceView = mapper
				.readValue(mapper.writeValueAsString(measurement.getDevice()), Device.DeviceView.class);

			jGen.writeStartObject();
			jGen.writeStringField("tenant", measurement.getDevice().getTenant());

			jGen.writeStringField("frequency", measurement.getFrequency());
			jGen.writeStringField("time", simpleDateFormat.format(measurement.getTime()));

			jGen.writeObjectField("pm2_5", getAllValues(measurement.getPm2_5()));
			jGen.writeObjectField("pm10", getAllValues(measurement.getPm10()));
			jGen.writeObjectField("pm1", getAllValues(measurement.getPm1()));
			jGen.writeObjectField("no2", getAllValues(measurement.getNo2()));
			jGen.writeObjectField("externalTemperature", getValue(measurement.getExternalTemperature()));
			jGen.writeObjectField("externalHumidity", getValue(measurement.getExternalHumidity()));
			jGen.writeObjectField("externalPressure", getValue(measurement.getExternalPressure()));
			jGen.writeObjectField("speed", getValue(measurement.getPm1()));
			jGen.writeObjectField("altitude", getValue(measurement.getNo2()));
			jGen.writeObjectField("location", measurement.getLocation());

			jGen.writeObjectField("device", deviceView);
			jGen.writeObjectField("site", siteView);

			jGen.writeEndObject();
		}

		private Object getValue(Measurement.MeasurementValue measurementValue) {
			Map<String, Double> hashMap = new HashMap<>();
			hashMap.put("value", measurementValue.getValue());
			return hashMap;
		}

		private Object getAllValues(Measurement.MeasurementValue measurementValue) {
			Map<String, Double> hashMap = new HashMap<>();
			hashMap.put("calibratedValue", measurementValue.getCalibratedValue());
			hashMap.put("value", measurementValue.getValue());
			return hashMap;
		}

	}

}

