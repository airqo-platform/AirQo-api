package airqo.models;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class SiteDetails {

    @JsonAlias({ "site_id", "siteId" })
    String _id = "";

    public SiteDetails() {
    }

    @Override
    public String toString() {
        return "SiteDetails{" +
                "_id='" + _id + '\'' +
                '}';
    }
}
