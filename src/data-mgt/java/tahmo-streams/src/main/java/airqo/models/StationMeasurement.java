package airqo.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

import java.util.Date;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class StationMeasurement {

    Date time = null;
    String code = null;
    Double humidity = null;
    Double temperature = null;

    public boolean isNotNull() {
        return ((this.getTime() != null) && (this.getCode() != null));
    }

    public boolean isTemperature() {
        return this.getTemperature() != null;
    }

    public boolean isHumidity() {
        return this.getHumidity() != null;
    }
}
