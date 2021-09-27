package airqo.serializers;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.ObjectCodec;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;

import java.io.IOException;

public class LocationSerializer {

	public static class GeoPointDeserializer extends JsonDeserializer<GeoJsonPoint> {

		@Override
		public GeoJsonPoint deserialize(JsonParser jsonParser, DeserializationContext ctxt) throws IOException {

			ObjectCodec codec = jsonParser.getCodec();
			JsonNode tree = codec.readTree(jsonParser);
			double latitude = tree.get("latitude").doubleValue();
			double longitude = tree.get("longitude").doubleValue();

			return new GeoJsonPoint(latitude, longitude);

		}
	}


}

