package airqo.models;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.io.Serializable;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;

import static airqo.config.Constants.dateTimeHourlyFormat;

@Document(collection = "hourly_measurements")
@CompoundIndexes({
	@CompoundIndex(name = "Hourly Measurements Composite Key", def = "{'time' : 1, 'device.id': 1, 'frequency': 1}", unique = true)
})
public class HourlyMeasurement extends Measurement {

	@Transient
	@JsonIgnore
	private final SimpleDateFormat simpleDateFormat = new SimpleDateFormat(dateTimeHourlyFormat);

	@Override
	public Date getTime() {
		try {
			return simpleDateFormat.parse(simpleDateFormat.format(super.getTime()));
		} catch (ParseException e) {
			e.printStackTrace();
		}

		return super.getTime();
	}

	@Override
	public void setTime(Date time) {
		try {
			Date hourlyDate = simpleDateFormat.parse(simpleDateFormat.format(time));
			super.setTime(hourlyDate);
		} catch (ParseException e) {
			e.printStackTrace();
			super.setTime(time);
		}
	}

	@Override
	public String getFrequency() {
		return Frequency.HOURLY.toString();
	}

	@Override
	public void setFrequency(String frequency) {
		super.setFrequency(Frequency.HOURLY.toString());
	}

	@Getter
	@Setter
	@AllArgsConstructor
	@NoArgsConstructor
	@ToString
	@JsonIgnoreProperties(ignoreUnknown = true)
	public static class MeasurementsList implements Serializable {
		private List<HourlyMeasurement> measurements;
	}
}
