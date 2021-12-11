package airqo.models;

import com.fasterxml.jackson.annotation.*;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.io.Serializable;
import java.util.Date;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
@Document(collection = "devices")
public class Device implements Serializable {

	@Field("_id")
	@Id
	@JsonAlias("_id")
	private String id;

	@JsonAlias("long_name")
	private String longName = "";

	@JsonAlias("deployment_date")
	private Date deploymentDate = new Date();

	@JsonAlias("maintenance_date")
	private Date maintenanceDate = new Date();

	@JsonAlias("recall_date")
	private Date recallDate = new Date();

	@DBRef
	@JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
	private Site site = new Site();

	private String name = "";
	private String tenant = "";
	private String mountType = "";
	private Double height;
	private boolean primaryInLocation = false;

	@JsonIgnore
	@JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'hh:mm:ss.SSS'Z'")
	private Date nextMaintenance = new Date();
	private boolean isActive = false;

	@JsonAlias("device_number")
	private Integer deviceNumber = 0;
	private String description = "";

	private Date createdAt = new Date();
	private boolean visibility = false;
	private String writeKey = "";
	private String readKey = "";
	private Double latitude;
	private Double longitude;

	@Override
	public String toString() {
		return "Device{" +
			"id='" + id + '\'' +
			", longName='" + longName + '\'' +
			", name='" + name + '\'' +
			", tenant='" + tenant + '\'' +
			", primaryInLocation=" + primaryInLocation +
			", nextMaintenance=" + nextMaintenance +
			", isActive=" + isActive +
			", deviceNumber=" + deviceNumber +
			", description='" + description + '\'' +
			", createdAt=" + createdAt +
			", latitude=" + latitude +
			", longitude=" + longitude +
			'}';
	}

	@Getter
	@Setter
	@AllArgsConstructor
	@NoArgsConstructor
	@ToString
	@JsonIgnoreProperties(ignoreUnknown = true)
	public static class DeviceList implements Serializable {
		private List<Device> devices;
	}

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
