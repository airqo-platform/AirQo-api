package airqo.models;

import com.fasterxml.jackson.annotation.*;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.io.Serializable;
import java.util.Date;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
@Document(collection = "devices")
public class Device implements Serializable {

	@Field("_id")
	@Id
	@JsonAlias("_id")
	private String id;

	@JsonAlias("long_name")
	private String longName;

	@JsonAlias("deployment_date")
	private Date deploymentDate;

	@JsonAlias("maintenance_date")
	private Date maintenanceDate;

	@JsonAlias("recall_date")
	private Date recallDate;

	@DBRef
	@JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
	@Indexed
	private Site site;

	@Indexed
	private String name;

	@Indexed
	private Tenant tenant;

	@Indexed
	private boolean primaryInLocation;

	@JsonIgnore
	@JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'hh:mm:ss.SSS'Z'")
	private Date nextMaintenance;

	@Indexed
	private boolean isActive;

	@JsonAlias("device_number")
	@Indexed
	private Integer deviceNumber;

	private String description;
	private String mountType;
	private Double height;
	private Date createdAt;
	private boolean visibility;
	private String writeKey;
	private String readKey;
	private Double latitude;
	private Double longitude;

	@Getter
	@Setter
	@AllArgsConstructor
	@NoArgsConstructor
	@ToString
	@JsonIgnoreProperties(ignoreUnknown = true)
	public static class DeviceView implements Serializable {
		private Double latitude;
		private Double longitude;
		private String name;

		@JsonAlias({"_id", "id"})
		private String id;
	}

}
