package airqo.serializers;

import airqo.models.Device;
import airqo.models.Site;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializerProvider;
import org.springframework.boot.jackson.JsonComponent;

import java.io.IOException;
import java.util.List;

@JsonComponent
public class SiteSerializer {

	public static class Serializer extends JsonSerializer<Site> {

		@Override
		public void serialize(Site site, JsonGenerator jGen, SerializerProvider serializerProvider) throws IOException {

			ObjectMapper mapper = new ObjectMapper();
			List<Device.DeviceView> deviceViews = mapper
				.readValue(mapper.writeValueAsString(site.getDevices()), new TypeReference<>() {
				});

			jGen.writeStartObject();
			jGen.writeStringField("id", site.getId());
			jGen.writeStringField("name", site.getName());
			jGen.writeStringField("tenant", site.getTenant());
			jGen.writeStringField("description", site.getDescription());

			jGen.writeNumberField("latitude", site.getLatitude());
			jGen.writeNumberField("longitude", site.getLongitude());
			jGen.writeStringField("street", site.getStreet());
			jGen.writeStringField("city", site.getCity());
			jGen.writeStringField("subCounty", site.getSub_county());
			jGen.writeStringField("county", site.getCounty());
			jGen.writeStringField("parish", site.getParish());
			jGen.writeStringField("region", site.getRegion());
			jGen.writeStringField("district", site.getDistrict());
			jGen.writeStringField("country", site.getCountry());

			jGen.writeObjectField("nearestRoad", site.getNearestRoad());
			jGen.writeObjectField("nearestPrimaryRoad", site.getNearestPrimaryRoad());
			jGen.writeObjectField("nearestTertiaryRoad", site.getNearestRoad());
			jGen.writeObjectField("nearestUnclassifiedRoad", site.getNearestUnclassifiedRoad());
			jGen.writeObjectField("nearestResidentialRoad", site.getNearestResidentialRoad());
			jGen.writeObjectField("bearingToKampalaCenter", site.getBearingToKampalaCenter());
			jGen.writeObjectField("distanceToKampalaCenter", site.getDistanceToKampalaCenter());

//			jGen.writeObjectField("location", site.getLocation());

			jGen.writeObjectField("nearestTahmoStation", site.getTahmo());
			jGen.writeObjectField("devices", deviceViews);
			jGen.writeEndObject();
		}
	}


}

