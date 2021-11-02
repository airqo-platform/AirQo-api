package airqo.models;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

import java.io.Serializable;

@Getter
@Setter
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class AirqoDevice implements Serializable {

    @JsonAlias({ "name" })
    private String device = "";

    @JsonAlias({ "channelID", "device_number" })
    private int deviceNumber = -1;

    @JsonAlias({ "site_details", "siteDetails" })
    private SiteDetails site = new SiteDetails();
}

