package airqo.models;

import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "raw_measurements")
@CompoundIndexes({
	@CompoundIndex(name = "Faw Measurements Composite Key", def = "{'time' : 1, 'device': 1}", unique = true)
})
public class RawMeasurement extends Measurement {
}
