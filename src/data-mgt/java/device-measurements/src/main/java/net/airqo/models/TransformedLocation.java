package net.airqo.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.io.Serializable;

@JsonIgnoreProperties(ignoreUnknown = true)
public class TransformedLocation implements Serializable {

    public static class LocationValue implements Serializable{
        Double value;

        public LocationValue(Double value) {
            this.value = value;
        }

        public Double getValue() {
            return value;
        }

        public void setValue(Double value) {
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

    public LocationValue getLatitude() {
        return latitude;
    }

    public void setLatitude(LocationValue latitude) {
        this.latitude = latitude;
    }

    public LocationValue getLongitude() {
        return longitude;
    }

    public void setLongitude(LocationValue longitude) {
        this.longitude = longitude;
    }
}
