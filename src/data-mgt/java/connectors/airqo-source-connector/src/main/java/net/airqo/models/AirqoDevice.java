package net.airqo.models;

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

    @SerializedName("channelID")
    @Expose
    @JsonAlias({ "channelID" })
    private int channelId = -1;

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

    public int getChannelId() {
        return channelId;
    }

    public void setChannelId(int channelId) {
        this.channelId = channelId;
    }

    public String getDevice() {
        return device;
    }

    public void setDevice(String device) {
        this.device = device;
    }
}

