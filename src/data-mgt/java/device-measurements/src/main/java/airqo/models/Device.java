package airqo.models;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.google.gson.annotations.Expose;
import com.google.gson.annotations.SerializedName;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Setter
@Getter
@JsonIgnoreProperties(ignoreUnknown = true)
public class Device implements Serializable {

    @SerializedName("device")
    @Expose
    @JsonAlias({ "device_name", "deviceName" })
    private String name = "";

    @SerializedName("_id")
    @Expose
    @JsonAlias({ "id", "device_id" })
    private String _id = "";

    @SerializedName("site")
    @Expose
    @JsonAlias({ "site_details", "siteDetails" })
    private SiteDetails site = new SiteDetails();

    @Override
    public String toString() {
        return "Device{" +
                "name='" + name + '\'' +
                ", _id='" + _id + '\'' +
                ", site=" + site +
                '}';
    }
}
