package airqo.serializers;

import airqo.models.Device;
import airqo.models.Forecast;
import airqo.models.Frequency;
import airqo.models.Insight;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;
import com.fasterxml.jackson.databind.ser.std.StdSerializer;
import com.mongodb.BasicDBObject;
import com.mongodb.DBObject;
import org.springframework.boot.jackson.JsonComponent;
import org.springframework.core.convert.converter.Converter;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;

import static airqo.config.Constants.*;

//@Component
public class InsightSerializer {

	public static class InsightIdWriteConverter implements Converter<Insight.InsightId, DBObject> {
		@Override
		public DBObject convert(Insight.InsightId person) {
			DBObject dbObject = new BasicDBObject();
			dbObject.put("first", person.getFrequency());
			dbObject.put("last", person.getSiteId());
			return dbObject;
		}

	}
	public static class InsightIdReadConverter implements Converter<DBObject, Insight.InsightId> {
		@Override
		public Insight.InsightId convert(DBObject dbo) {
			return new Insight.InsightId((Date)dbo.get("first"), (Frequency) dbo.get("last"), (String)dbo.get("last"));
		}
	}

//	public static class Serializer extends JsonSerializer<Insight> {
//
//		@Override
//		public void serialize(Insight insight, JsonGenerator jGen, SerializerProvider serializerProvider)
//			throws IOException {
//
//			SimpleDateFormat simpleDateFormat = new SimpleDateFormat(dateTimeFormat);
//
////			private Date time;
////			private double pm2_5;
////			private double pm10;
////			private Boolean isEmpty = false;
////			private Boolean isForecast = false;
////			private String name;
////			private String location;
////			private Frequency frequency;
////			private String siteId;
////
////			ObjectMapper mapper = new ObjectMapper();
////			jGen.writeStartObject();
////			jGen.writeStringField("time", simpleDateFormat.format(forecast.getTime()));
////			jGen.writeNumberField("pm2_5", forecast.getPm2_5());
////			jGen.writeNumberField("pm10", forecast.getLowerConfidenceInterval());
////			jGen.writeNumberField("isEmpty", forecast.getUpperConfidenceInterval());
////			jGen.writeObjectField("isForecast", deviceView);
////			jGen.writeObjectField("name", deviceView);
////			jGen.writeObjectField("location", deviceView);
////			jGen.writeObjectField("frequency", deviceView);
////			jGen.writeObjectField("siteId", deviceView);
//
//			jGen.writeEndObject();
//		}
//	}
//
//	public static class ForecastDateSerializer extends StdSerializer<Date> {
//
//		private final SimpleDateFormat formatter = new SimpleDateFormat(dateTimeHourlyFormat);
//
//		public ForecastDateSerializer() {
//			this(null);
//		}
//
//		public ForecastDateSerializer(Class<Date> t) {
//			super(t);
//		}
//
//		@Override
//		public void serialize(Date date, JsonGenerator jsonGenerator, SerializerProvider serializerProvider)
//			throws IOException {
//			jsonGenerator.writeString(formatter.format(date));
//		}
//	}
//
//	public static class ForecastDateDeserializer extends StdDeserializer<Date> {
//
//		private final SimpleDateFormat formatter = new SimpleDateFormat(forecastDateTimeFormat);
//		private final SimpleDateFormat hourlyFormatter = new SimpleDateFormat(dateTimeHourlyFormat);
//
//		public ForecastDateDeserializer() {
//			this(null);
//		}
//
//		public ForecastDateDeserializer(Class<?> vc) {
//			super(vc);
//		}
//
//		@Override
//		public Date deserialize(JsonParser jsonParser, DeserializationContext deserializationContext) throws IOException {
//			String date = jsonParser.getText();
//			try {
//				Date forecastDate = formatter.parse(date);
//				return hourlyFormatter.parse(hourlyFormatter.format(forecastDate));
//			} catch (ParseException e) {
//				throw new RuntimeException(e);
//			}
//		}
//	}

}

