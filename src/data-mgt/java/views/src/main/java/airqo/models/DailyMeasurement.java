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

import static airqo.config.Constants.dateTimeDailyFormat;

@Document(collection = "daily_measurements")
@CompoundIndexes({
	@CompoundIndex(name = "Daily Measurements Composite Key", def = "{'time' : 1, 'device': 1}", unique = true)
})
public class DailyMeasurement extends Measurement {

	@Transient
	@JsonIgnore
	private final SimpleDateFormat simpleDateFormat = new SimpleDateFormat(dateTimeDailyFormat);

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
		return Frequency.DAILY.toString();
	}

	@Override
	public void setFrequency(String frequency) {
		super.setFrequency(Frequency.DAILY.toString());
	}


	@Getter
	@Setter
	@AllArgsConstructor
	@NoArgsConstructor
	@ToString
	@JsonIgnoreProperties(ignoreUnknown = true)
	public static class MeasurementsList implements Serializable {
		private List<DailyMeasurement> measurements;
	}
}
