package airqo.models;

import airqo.serializers.LocationSerializer;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexed;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

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
public class Site {

	@Field("_id")
	@Id
	@JsonAlias("_id")
	public String id;
	@GeoSpatialIndexed(name = "location")
	Double[] location;
	@JsonDeserialize(using = LocationSerializer.GeoPointDeserializer.class)
	GeoJsonPoint geoJsonPoint;
	@JsonAlias("lat_long")
	private String latLong;
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
//	@JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
	private Collection<Device> devices = new ArrayList<>();
	@JsonAlias("nearest_tahmo_station")
//	@DBRef
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

	@Getter
	@Setter
	@AllArgsConstructor
	@NoArgsConstructor
	@ToString
	@JsonIgnoreProperties(ignoreUnknown = true)
	public static class Geometry {
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
	public static class Viewport {
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
	public static class Location {
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
	public static class SiteList {
		private List<Site> sites;
	}

	@Getter
	@Setter
	@AllArgsConstructor
	@NoArgsConstructor
	@ToString
	@JsonIgnoreProperties(ignoreUnknown = true)
	public static class SiteView {

		@JsonAlias("_id")
		public String id;

		private String name = "";
		private String description = "";

		private Double latitude;
		private Double longitude;
	}

}
