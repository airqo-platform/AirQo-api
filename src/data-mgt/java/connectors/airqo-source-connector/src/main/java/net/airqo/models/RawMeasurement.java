package net.airqo.models;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.google.gson.annotations.Expose;
import com.google.gson.annotations.SerializedName;

@JsonIgnoreProperties(ignoreUnknown = true)
public class RawMeasurement {

    @SerializedName("created_at")
    @Expose
    @JsonAlias({ "created_at" })
    private String time;

    @SerializedName("pm2_5")
    @Expose
    @JsonAlias({ "pm2_5" })
    private String pm25 = "null";

    private int channelID = 0;

    private String device = "null";

    @SerializedName("pm10")
    @Expose
    private String pm10 = "null";

    @SerializedName("s2_pm2_5")
    @Expose
    @JsonAlias({ "s2_pm2_5" })
    private String s2Pm25 = "null";

    @SerializedName("s2_pm10")
    @Expose
    @JsonAlias({ "s2_pm10" })
    private String s2Pm10 = "null";

    @SerializedName("latitude")
    @Expose
    private String latitude = "null";

    @SerializedName("longitude")
    @Expose
    private String longitude = "null";

    @SerializedName("battery")
    @Expose
    private String battery = "null";

    @SerializedName("altitude")
    @Expose
    private String altitude = "null";

    @SerializedName("speed")
    @Expose
    private String speed = "null";

    @SerializedName("satellites")
    @Expose
    private String satellites = "null";

    @SerializedName("internalTemperature")
    @Expose
    private String internalTemperature = "null";

    @SerializedName("internalHumidity")
    @Expose
    private String internalHumidity = "null";

    @SerializedName("hdop")
    @Expose
    private String hdop = "null";

    @SerializedName("externalTemperature")
    @Expose
    private String externalTemperature = "null";

    @SerializedName("ExternalHumidity")
    @Expose
    @JsonAlias({ "ExternalHumidity" })
    private String externalHumidity = "null";

    @SerializedName("ExternalPressure")
    @Expose
    @JsonAlias({ "ExternalPressure" })
    private String externalPressure = "null";

    @SerializedName("ExternalAltitude")
    @Expose
    @JsonAlias({ "ExternalAltitude" })
    private String externalAltitude = "null";

    public String getExternalAltitude() {
        return externalAltitude;
    }

    public void setExternalAltitude(String externalAltitude) {
        this.externalAltitude = externalAltitude;
    }

    public int getChannelID() {
        return channelID;
    }

    public void setChannelID(int channelID) {
        this.channelID = channelID;
    }

    public String getDevice() {
        return device;
    }

    public void setDevice(String device) {
        this.device = device;
    }

    public String getTime() {
        return time;
    }

    public void setTime(String time) {
        this.time = time;
    }

    public String getPm25() {
        return pm25;
    }

    public void setPm25(String pm25) {
        this.pm25 = pm25;
    }

    public String getPm10() {
        return pm10;
    }

    public void setPm10(String pm10) {
        this.pm10 = pm10;
    }

    public String getS2Pm25() {
        return s2Pm25;
    }

    public void setS2Pm25(String s2Pm25) {
        this.s2Pm25 = s2Pm25;
    }

    public String getS2Pm10() {
        return s2Pm10;
    }

    public void setS2Pm10(String s2Pm10) {
        this.s2Pm10 = s2Pm10;
    }

    public String getLatitude() {
        return latitude;
    }

    public void setLatitude(String latitude) {
        this.latitude = latitude;
    }

    public String getLongitude() {
        return longitude;
    }

    public void setLongitude(String longitude) {
        this.longitude = longitude;
    }

    public String getBattery() {
        return battery;
    }

    public void setBattery(String battery) {
        this.battery = battery;
    }

    public String getAltitude() {
        return altitude;
    }

    public void setAltitude(String altitude) {
        this.altitude = altitude;
    }

    public String getSpeed() {
        return speed;
    }

    public void setSpeed(String speed) {
        this.speed = speed;
    }

    public String getSatellites() {
        return satellites;
    }

    public void setSatellites(String satellites) {
        this.satellites = satellites;
    }

    public String getInternalTemperature() {
        return internalTemperature;
    }

    public void setInternalTemperature(String internalTemperature) {
        this.internalTemperature = internalTemperature;
    }

    public String getInternalHumidity() {
        return internalHumidity;
    }

    public void setInternalHumidity(String internalHumidity) {
        this.internalHumidity = internalHumidity;
    }

    public String getHdop() {
        return hdop;
    }

    public void setHdop(String hdop) {
        this.hdop = hdop;
    }

    public String getExternalTemperature() {
        return externalTemperature;
    }

    public void setExternalTemperature(String externalTemperature) {
        this.externalTemperature = externalTemperature;
    }

    public String getExternalHumidity() {
        return externalHumidity;
    }

    public void setExternalHumidity(String externalHumidity) {
        this.externalHumidity = externalHumidity;
    }

    public String getExternalPressure() {
        return externalPressure;
    }

    public void setExternalPressure(String externalPressure) {
        this.externalPressure = externalPressure;
    }
}
