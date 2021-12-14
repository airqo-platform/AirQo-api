package airqo.models;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Date;
import java.util.List;


@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
@Document(collection = "sites")
@JsonIgnoreProperties(ignoreUnknown = true)
public class Site implements Serializable {

	@Field("_id")
	@Id
	@JsonAlias("_id")
	public String id;
	@JsonIgnore
	GeoJsonPoint location;
	@JsonAlias("lat_long")
	private String latLong;
	@JsonAlias("formatted_name")
	private String formattedName = "";
	@JsonAlias("search_name")
	private String searchName = "";
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

	@JsonAlias("nearest_tahmo_station")
	private Tahmo tahmo;
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
	@JsonAlias({"geometry"})
	private Geometry geometry;

	public String getLocation() {
		return this.getDistrict() + " " + this.getCountry();
	}

	@Getter
	@Setter
	@AllArgsConstructor
	@NoArgsConstructor
	@ToString
	@JsonIgnoreProperties(ignoreUnknown = true)
	public static class Geometry implements Serializable {
		Location location;

		@JsonAlias("location_type")
		String locationType;

		@JsonAlias("viewport")
		Viewport viewport;
	}

	@Getter
	@Setter
	@AllArgsConstructor
	@NoArgsConstructor
	@ToString
	@JsonIgnoreProperties(ignoreUnknown = true)
	public static class Viewport implements Serializable {
		@JsonAlias({"northeast"})
		Location northEast;

		@JsonAlias({"southwest"})
		Location southWest;
	}

	@Getter
	@Setter
	@AllArgsConstructor
	@NoArgsConstructor
	@ToString
	@JsonIgnoreProperties(ignoreUnknown = true)
	public static class Location implements Serializable {
		@JsonAlias({"lat", "latitude"})
		Double latitude;

		@JsonAlias({"lng", "longitude"})
		Double longitude;
	}


	@Getter
	@Setter
	@AllArgsConstructor
	@NoArgsConstructor
	@ToString
	@JsonIgnoreProperties(ignoreUnknown = true)
	public static class SiteList implements Serializable {
		private List<Site> sites;
	}

	@Getter
	@Setter
	@AllArgsConstructor
	@NoArgsConstructor
	@ToString
	@JsonIgnoreProperties(ignoreUnknown = true)
	public static class SiteView implements Serializable {

		@JsonAlias("_id")
		public String id;

		private String name = "";
		private String description = "";

		private Double latitude;
		private Double longitude;
	}

}
