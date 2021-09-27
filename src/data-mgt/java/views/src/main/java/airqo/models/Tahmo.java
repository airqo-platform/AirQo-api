package airqo.models;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
@Document(collection = "tahmo")
public class Tahmo {

	@Field("_id")
	@Id
	@JsonAlias("_id")
	public int id;
	private String code = "";
	private String timezone = "";
	private Double latitude;
	private Double longitude;
}
