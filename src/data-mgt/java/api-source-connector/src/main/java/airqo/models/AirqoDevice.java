package airqo.models;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.google.gson.annotations.Expose;
import com.google.gson.annotations.SerializedName;

import java.io.Serializable;

@JsonIgnoreProperties(ignoreUnknown = true)
public class AirqoDevice implements Serializable {

    @SerializedName("device")
    @Expose
    @JsonAlias({ "name" })
    private String device = "";

    @SerializedName("device_number")
    @Expose
    @JsonAlias({ "channelID", "device_number" })
    private int deviceNumber = -1;

    @SerializedName("site")
    @Expose
    @JsonAlias({ "site_details", "siteDetails" })
    private SiteDetails site = new SiteDetails();

    public SiteDetails getSite() {
        return site;
    }

    public void setSite(SiteDetails site) {
        this.site = site;
    }

    public int getDeviceNumber() {
        return deviceNumber;
    }

    public void setDeviceNumber(int deviceNumber) {
        this.deviceNumber = deviceNumber;
    }

    public String getDevice() {
        return device;
    }

    public void setDevice(String device) {
        this.device = device;
    }

    @Override
    public String toString() {
        return "AirqoDevice{" +
                "device='" + device + '\'' +
                ", deviceNumber=" + deviceNumber +
                ", site=" + site +
                '}';
    }
}

