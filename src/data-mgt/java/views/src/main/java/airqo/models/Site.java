package airqo.models;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Date;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
@Document("sites")
public class Site {

	@Field("_id")
	@Id
	@JsonAlias("_id")
	public String id;

	@JsonAlias("lat_long")
	private Double latLong;

	@JsonAlias("formatted_name")
	private String formattedName = "";

	@JsonAlias("generated_name")
	private String generatedName = "";

	@JsonAlias("landform_90")
	private Double landform90;

	@JsonAlias("landform270")
	private Double landform_270;

	@JsonAlias("distance_to_nearest_road")
	private Double nearestRoad;

	@JsonAlias("distance_to_nearest_primary_road")
	private Double nearestPrimaryRoad;

	@JsonAlias("distance_to_nearest_tertiary_road")
	private Double nearestTertiaryRoad;

	@JsonAlias("distance_to_nearest_unclassified_road")
	private Double nearestUnclassifiedRoad;

	@JsonAlias("distance_to_nearest_residential_road")
	private Double nearestResidentialRoad;

	@JsonAlias("bearing_to_kampala_center")
	private Double bearingToKampalaCenter;

	@JsonAlias("distance_to_kampala_center")
	private Double distanceToKampalaCenter;

	@JsonAlias("site_tags")
	private Collection<String> tags;

	@JsonAlias("devices")
	@DBRef
	private Collection<Device> devices = new ArrayList<>();

	private String tenant = "";
	private String name = "";
	private String description = "";
	private Double latitude;
	private Double longitude;
	private String district = "";
	private String country = "";
	private String sub_county = "";
	private String parish = "";
	private String region = "";
	private Date recallDate = new Date();
	private String city = "";
	private String street = "";
	private String county = "";
	private Double altitude;
	private Double greenness;
	private Double aspect;
	private Double height;
	private boolean primaryInLocation = false;
	private Date nextMaintenance = new Date();
	private boolean isActive = false;
	private Integer deviceNumber = 0;
	private Date createdAt = new Date();
	private boolean visibility = false;

}
