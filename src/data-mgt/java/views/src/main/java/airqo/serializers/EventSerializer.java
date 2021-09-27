package airqo.serializers;

import airqo.models.Device;
import airqo.models.Event;
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
public class EventSerializer {

	public static class Serializer extends JsonSerializer<Event> {

		@Override
		public void serialize(Event event, JsonGenerator jGen, SerializerProvider serializerProvider) throws IOException {

			SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
			simpleDateFormat.setTimeZone(TimeZone.getTimeZone("UTC"));

			ObjectMapper mapper = new ObjectMapper();
			Site.SiteView siteView = mapper
				.readValue(mapper.writeValueAsString(event.getDevice().getSite()), Site.SiteView.class);

			Device.DeviceView deviceView = mapper
				.readValue(mapper.writeValueAsString(event.getDevice()), Device.DeviceView.class);

			jGen.writeStartObject();
			jGen.writeStringField("id", event.getId());
			jGen.writeStringField("tenant", event.getDevice().getTenant());

			jGen.writeStringField("frequency", event.getFrequency());
			jGen.writeStringField("time", simpleDateFormat.format(event.getTime()));

			jGen.writeObjectField("pm2_5", getAllValues(event.getPm2_5()));
			jGen.writeObjectField("pm10", getAllValues(event.getPm10()));
			jGen.writeObjectField("pm1", getAllValues(event.getPm1()));
			jGen.writeObjectField("no2", getAllValues(event.getNo2()));
			jGen.writeObjectField("externalTemperature", getValue(event.getExternalTemperature()));
			jGen.writeObjectField("externalHumidity", getValue(event.getExternalHumidity()));
			jGen.writeObjectField("externalPressure", getValue(event.getExternalPressure()));
			jGen.writeObjectField("speed", getValue(event.getPm1()));
			jGen.writeObjectField("altitude", getValue(event.getNo2()));
			jGen.writeObjectField("location", event.getLocation());

			jGen.writeObjectField("device", deviceView);
			jGen.writeObjectField("site", siteView);

			jGen.writeEndObject();
		}

		private Object getValue(Event.MeasurementValue measurementValue) {
			Map<String, Double> hashMap = new HashMap<>();
			hashMap.put("value", measurementValue.getValue());
			return hashMap;
		}

		private Object getAllValues(Event.MeasurementValue measurementValue) {
			Map<String, Double> hashMap = new HashMap<>();
			hashMap.put("calibratedValue", measurementValue.getCalibratedValue());
			hashMap.put("value", measurementValue.getValue());
			return hashMap;
		}

	}

}

