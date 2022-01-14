package airqo.serializers;

import airqo.models.Site;
import airqo.models.Weather;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.*;
import org.springframework.boot.jackson.JsonComponent;

import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;

import static airqo.config.Constants.dateTimeFormat;

@JsonComponent
public class WeatherSerializer {

	public static class Serializer extends JsonSerializer<Weather> {

		SimpleDateFormat simpleDateFormat = new SimpleDateFormat(dateTimeFormat);
		ObjectMapper mapper = new ObjectMapper();

		@Override
		public void serialize(Weather weather, JsonGenerator jGen, SerializerProvider serializerProvider) throws IOException {

			Site.SiteView siteView = mapper
				.readValue(mapper.writeValueAsString(weather.getSite()), Site.SiteView.class);

			jGen.writeStartObject();
			jGen.writeObjectField("frequency", weather.getFrequency());
			jGen.writeObjectField("time", simpleDateFormat.format(weather.getTime()));
			jGen.writeObjectField("humidity", weather.getHumidity());
			jGen.writeObjectField("windSpeed", weather.getWindSpeed());
			jGen.writeObjectField("site", siteView);

			jGen.writeEndObject();
		}

	}

	public static class DeSerializer extends JsonDeserializer<Weather> {

		SimpleDateFormat simpleDateFormat = new SimpleDateFormat(dateTimeFormat);

		@Override
		public Weather deserialize(JsonParser jsonParser, DeserializationContext deserializationContext)
			throws IOException {
			JsonNode node = jsonParser.getCodec().readTree(jsonParser);
			try {

				Date time = simpleDateFormat.parse(node.get("time").asText());
				String frequency = node.get("frequency").asText().toUpperCase();
				if (!(frequency.equalsIgnoreCase("hourly") || frequency.equalsIgnoreCase("daily"))) {
					throw new Exception("Invalid frequency");
				}
				String siteId = node.get("siteId").asText();
				Double temperature = node.get("temperature").asDouble();
				Double humidity = node.get("humidity").asDouble();
				Double windSpeed = node.get("windSpeed").asDouble();

				Weather weather = new Weather(time, frequency, temperature, humidity, windSpeed);
				weather.setSite(new Site(siteId));
				weather.setId();

				return weather;
			} catch (Exception e) {
				e.printStackTrace();
			}
			return null;
		}
	}
}

