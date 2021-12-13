package airqo.models;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
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
}

