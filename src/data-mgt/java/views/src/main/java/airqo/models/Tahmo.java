package airqo.models;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.io.Serializable;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
@Document(collection = "tahmo")
@JsonIgnoreProperties(ignoreUnknown = true)
public class Tahmo implements Serializable {

	@Field("_id")
	@Id
	@JsonAlias("_id")
	public int id;
	private String code = "";
	private String timezone = "";
	private Double latitude;
	private Double longitude;

	@JsonIgnore
	private GeoJsonPoint geoJsonPoint;

	public void setGeoJsonPoint(Double latitude, Double longitude) {
		this.geoJsonPoint = new GeoJsonPoint(latitude, longitude);
	}
}
