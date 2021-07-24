package airqo.models;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class SiteDetails {

    @JsonAlias({ "site_id", "siteId" })
    String _id = "";

    public SiteDetails() {
    }

    public String get_id() {
        return _id;
    }

    public void set_id(String _id) {
        this._id = _id;
    }

    @Override
    public String toString() {
        return "SiteDetails{" +
                "_id='" + _id + '\'' +
                '}';
    }
}
