package airqo.serializers;

import airqo.models.Device;
import airqo.models.Forecast;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;
import com.fasterxml.jackson.databind.ser.std.StdSerializer;
import org.springframework.boot.jackson.JsonComponent;

import java.io.IOException;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;

import static airqo.config.Constants.dateTimeFormat;
import static airqo.config.Constants.forecastDateTimeFormat;

@JsonComponent
public class ForecastSerializer {

	public static class Serializer extends JsonSerializer<Forecast> {

		@Override
		public void serialize(Forecast forecast, JsonGenerator jGen, SerializerProvider serializerProvider)
			throws IOException {

			SimpleDateFormat simpleDateFormat = new SimpleDateFormat(dateTimeFormat);

			ObjectMapper mapper = new ObjectMapper();
			Device.DeviceView deviceView = mapper
				.readValue(mapper.writeValueAsString(forecast.getDevice()), Device.DeviceView.class);

			jGen.writeStartObject();
			jGen.writeStringField("id", forecast.getId());
			jGen.writeStringField("time", simpleDateFormat.format(forecast.getTime()));
			jGen.writeNumberField("pm2_5", forecast.getPm2_5());
			jGen.writeNumberField("lowerConfidenceInterval", forecast.getLowerConfidenceInterval());
			jGen.writeNumberField("upperConfidenceInterval", forecast.getUpperConfidenceInterval());
			jGen.writeObjectField("device", deviceView);

			jGen.writeEndObject();
		}

	}

	public static class ForecastDateSerializer extends StdSerializer<Date> {

		private final SimpleDateFormat formatter = new SimpleDateFormat(forecastDateTimeFormat);

		public ForecastDateSerializer() {
			this(null);
		}

		public ForecastDateSerializer(Class<Date> t) {
			super(t);
		}

		@Override
		public void serialize(Date date, JsonGenerator jsonGenerator, SerializerProvider serializerProvider)
			throws IOException {
			jsonGenerator.writeString(formatter.format(date));
		}
	}

	public static class ForecastDateDeserializer extends StdDeserializer<Date> {

		private final SimpleDateFormat formatter = new SimpleDateFormat(forecastDateTimeFormat);

		public ForecastDateDeserializer() {
			this(null);
		}

		public ForecastDateDeserializer(Class<?> vc) {
			super(vc);
		}

		@Override
		public Date deserialize(JsonParser jsonParser, DeserializationContext deserializationContext) throws IOException {
			String date = jsonParser.getText();
			try {
				return formatter.parse(date);
			} catch (ParseException e) {
				throw new RuntimeException(e);
			}
		}
	}

}

