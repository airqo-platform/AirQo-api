package airqo.serializers;

import airqo.models.Event;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
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

            jGen.writeStartObject();
            jGen.writeStringField("tenant", event.getTenant());
            jGen.writeStringField("_id", event.getId());
            jGen.writeStringField("frequency", event.getFrequency());
            jGen.writeStringField("device", event.getDevice());
            jGen.writeStringField("time", simpleDateFormat.format(event.getTime()));
            jGen.writeNumberField("device_number", event.getDeviceNumber());
            jGen.writeStringField("device_id", event.getDeviceId());
            jGen.writeStringField("site_id", event.getSiteId());

            jGen.writeObjectField("average_pm2_5", getAllValues(event.getAveragePm2_5()));
            jGen.writeObjectField("average_pm10", getAllValues(event.getAveragePm10()));

            jGen.writeObjectField("externalTemperature", getValue(event.getExternalTemperature()));
            jGen.writeObjectField("externalHumidity", getValue(event.getExternalHumidity()));
            jGen.writeObjectField("location", event.getLocation());

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


        private Object getLocation(Event.Location location) {

            Map<String, Map<String, Double>> hashMap = new HashMap<>();

            hashMap.put("longitude", new HashMap<>() {{
                put("value", location.getLongitude());
            }});

            hashMap.put("latitude", new HashMap<>() {{
                put("value", location.getLatitude());
            }});

            return hashMap;
        }
    }

}
