package net.airqo.models;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.google.gson.annotations.Expose;
import com.google.gson.annotations.SerializedName;

import java.io.Serializable;

@JsonIgnoreProperties(ignoreUnknown = true)
public class Device implements Serializable {

    @SerializedName("device")
    @Expose
    @JsonAlias({ "device_name", "deviceName" })
    private String name = "";

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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
