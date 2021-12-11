package airqo.models;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.io.Serializable;
import java.util.Date;

import static airqo.config.Constants.dateTimeFormat;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
@Document(collection = "insights_measurements")
//@CompoundIndexes({
//	@CompoundIndex(name = "Insights Compound Index", def = "{'time' : 1, 'frequency': 1, 'siteId': 1}", unique = true)
//})
public class Insight implements Serializable {


	@Id
	private String id;
	@JsonFormat(shape = JsonFormat.Shape.STRING, pattern = dateTimeFormat, timezone = "UTC")
	private Date time;
	private double pm2_5;
	private double pm10;
	private Boolean isEmpty = false;
	private Boolean isForecast = false;
	private String name;
	private String location;
	private String frequency;
	private String siteId;

	public Insight(Date time, double pm2_5, double pm10, Boolean isEmpty, Boolean isForecast, String name, String location, String frequency, String siteId) {
		this.time = time;
		this.pm2_5 = pm2_5;
		this.pm10 = pm10;
		this.isEmpty = isEmpty;
		this.isForecast = isForecast;
		this.name = name;
		this.location = location;
		this.frequency = frequency;
		this.siteId = siteId;
		this.id = siteId + frequency + time.toString();
	}
}

