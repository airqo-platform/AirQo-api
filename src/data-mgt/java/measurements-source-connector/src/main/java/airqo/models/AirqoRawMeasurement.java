package airqo.models;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@ToString
public class AirqoRawMeasurement {

    @JsonAlias({ "created_at" })
    private String time;

    @JsonAlias({ "pm2_5" })
    private String pm25 = "null";

    @JsonAlias({ "ExternalHumidity" })
    private String externalHumidity = "null";

    @JsonAlias({ "ExternalPressure" })
    private String externalPressure = "null";

    @JsonAlias({ "ExternalAltitude" })
    private String externalAltitude = "null";

    @JsonAlias({ "s2_pm10" })
    private String s2Pm10 = "null";

    @JsonAlias({ "s2_pm2_5" })
    private String s2Pm25 = "null";

    private int channelID = -1;
    private String frequency = "raw";
    private String device = "null";
    private String site_id = "";
    private String pm10 = "null";
    private String latitude = "null";
    private String longitude = "null";
    private String battery = "null";
    private String altitude = "null";
    private String speed = "null";
    private String satellites = "null";
    private String internalTemperature = "null";
    private String internalHumidity = "null";
    private String hdop = "null";
    private String externalTemperature = "null";
}
