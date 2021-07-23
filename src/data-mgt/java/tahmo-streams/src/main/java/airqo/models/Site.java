package airqo.models;

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
    public static class SiteStation {
        private int id;
        private String code;
        private double latitude;
        private double longitude;
        private String timezone;
    }

    private SiteStation siteStation;
}
