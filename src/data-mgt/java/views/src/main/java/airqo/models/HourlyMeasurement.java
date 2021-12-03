package airqo.models;

import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "hourly_measurements")
@CompoundIndexes({
	@CompoundIndex(name = "PM 2.5", def = "{'time' : 1, 'device_id': 1, 'pm2_5.value': 1}", unique = true)
})
public class HourlyMeasurement extends Measurement{
	private final String frequency = "hourly";
}
