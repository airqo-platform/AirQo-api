package airqo;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class TransformedLocation implements Serializable {

    @Getter
    @Setter
    public static class LocationValue implements Serializable{
        Double value;

        public LocationValue(Double value) {
            this.value = value;
        }

    }

    private LocationValue latitude;
    private LocationValue longitude;

    public TransformedLocation(LocationValue latitude, LocationValue longitude) {
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public TransformedLocation() {
    }

    @Override
    public String toString() {
        return "TransformedLocation{" +
                "latitude=" + latitude +
                ", longitude=" + longitude +
                '}';
    }
}
