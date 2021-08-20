package airqo.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@JsonIgnoreProperties(ignoreUnknown = true)
@Getter
@Setter
public class TransformedLocation implements Serializable {

    @JsonIgnoreProperties(ignoreUnknown = true)
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

    @Override
    public String toString() {
        return "TransformedLocation{" +
                "latitude=" + latitude +
                ", longitude=" + longitude +
                '}';
    }
}
