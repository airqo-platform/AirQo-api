package airqo.serializers;

import airqo.models.Device;
import airqo.models.Site;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializerProvider;
import org.springframework.boot.jackson.JsonComponent;

import java.io.IOException;

@JsonComponent
public class DeviceSerializer {

	public static class Serializer extends JsonSerializer<Device> {

		@Override
		public void serialize(Device device, JsonGenerator jGen, SerializerProvider serializerProvider) throws IOException {

			ObjectMapper mapper = new ObjectMapper();
			Site.SiteView siteView = mapper
				.readValue(mapper.writeValueAsString(device.getSite()), Site.SiteView.class);

			jGen.writeStartObject();
			jGen.writeStringField("id", device.getId());
			jGen.writeNumberField("deviceNumber", device.getDeviceNumber());
			jGen.writeStringField("name", device.getName());
			jGen.writeStringField("tenant", device.getTenant().toString());
			jGen.writeStringField("description", device.getDescription());
			jGen.writeNumberField("latitude", device.getLatitude());
			jGen.writeNumberField("longitude", device.getLongitude());
			jGen.writeBooleanField("primaryInLocation", device.isPrimaryInLocation());
			jGen.writeBooleanField("isActive", device.isActive());
			jGen.writeObjectField("site", siteView);
			jGen.writeObjectField("recallDate", device.getRecallDate());
			jGen.writeEndObject();
		}
	}

}

