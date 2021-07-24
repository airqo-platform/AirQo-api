package airqo.models;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
@JsonIgnoreProperties(ignoreUnknown = true)
public class Site {

    @Setter
    @Getter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class NearestStation {
        private int id;
        private String code;
        private double latitude;
        private double longitude;
        private String timezone;

        @Override
        public String toString() {
            return "TahmoStation{" +
                    "id=" + id +
                    ", code='" + code + '\'' +
                    ", latitude=" + latitude +
                    ", longitude=" + longitude +
                    ", timezone='" + timezone + '\'' +
                    '}';
        }
    }

    @JsonAlias({ "nearest_tahmo_station" })
    private NearestStation nearestStation;
    private String _id;

    @Override
    public String toString() {
        return "Site{" +
                "tahmoStation=" + nearestStation +
                ", _id='" + _id + '\'' +
                '}';
    }
}
