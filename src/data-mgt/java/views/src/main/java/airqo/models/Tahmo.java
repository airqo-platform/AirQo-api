package airqo.models;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import org.springframework.data.annotation.Id;
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
}
