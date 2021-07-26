package airqo.models;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.google.gson.annotations.Expose;
import com.google.gson.annotations.SerializedName;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class AirQoRawMeasurement {

    @SerializedName("created_at")
    @Expose
    @JsonAlias({ "created_at" })
    private String time;

    @SerializedName("pm2_5")
    @Expose
    @JsonAlias({ "pm2_5" })
    private String pm25 = "null";

    @SerializedName("channelID")
    @Expose
    private int channelID = -1;

    @SerializedName("frequency")
    @Expose
    private String frequency = "raw";

    @SerializedName("device")
    @Expose
    private String device = "null";

    @SerializedName("site_id")
    @Expose
    private String site_id = "";

    @SerializedName("pm10")
    @Expose
    private String pm10 = "null";

    @SerializedName("s2_pm2_5")
    @Expose
    @JsonAlias({ "s2_pm2_5" })
    private String s2Pm25 = "null";

    @SerializedName("s2_pm10")
    @Expose
    @JsonAlias({ "s2_pm10" })
    private String s2Pm10 = "null";

    @SerializedName("latitude")
    @Expose
    private String latitude = "null";

    @SerializedName("longitude")
    @Expose
    private String longitude = "null";

    @SerializedName("battery")
    @Expose
    private String battery = "null";

    @SerializedName("altitude")
    @Expose
    private String altitude = "null";

    @SerializedName("speed")
    @Expose
    private String speed = "null";

    @SerializedName("satellites")
    @Expose
    private String satellites = "null";

    @SerializedName("internalTemperature")
    @Expose
    private String internalTemperature = "null";

    @SerializedName("internalHumidity")
    @Expose
    private String internalHumidity = "null";

    @SerializedName("hdop")
    @Expose
    private String hdop = "null";

    @SerializedName("externalTemperature")
    @Expose
    private String externalTemperature = "null";

    @SerializedName("ExternalHumidity")
    @Expose
    @JsonAlias({ "ExternalHumidity" })
    private String externalHumidity = "null";

    @SerializedName("ExternalPressure")
    @Expose
    @JsonAlias({ "ExternalPressure" })
    private String externalPressure = "null";

    @SerializedName("ExternalAltitude")
    @Expose
    @JsonAlias({ "ExternalAltitude" })
    private String externalAltitude = "null";

    @Override
    public String toString() {
        return "AirQoRawMeasurement{" +
                "time='" + time + '\'' +
                ", pm25='" + pm25 + '\'' +
                ", channelID=" + channelID +
                ", frequency='" + frequency + '\'' +
                ", device='" + device + '\'' +
                ", site_id='" + site_id + '\'' +
                ", pm10='" + pm10 + '\'' +
                ", s2Pm25='" + s2Pm25 + '\'' +
                ", s2Pm10='" + s2Pm10 + '\'' +
                ", latitude='" + latitude + '\'' +
                ", longitude='" + longitude + '\'' +
                ", battery='" + battery + '\'' +
                ", altitude='" + altitude + '\'' +
                ", speed='" + speed + '\'' +
                ", satellites='" + satellites + '\'' +
                ", internalTemperature='" + internalTemperature + '\'' +
                ", internalHumidity='" + internalHumidity + '\'' +
                ", hdop='" + hdop + '\'' +
                ", externalTemperature='" + externalTemperature + '\'' +
                ", externalHumidity='" + externalHumidity + '\'' +
                ", externalPressure='" + externalPressure + '\'' +
                ", externalAltitude='" + externalAltitude + '\'' +
                '}';
    }
}
