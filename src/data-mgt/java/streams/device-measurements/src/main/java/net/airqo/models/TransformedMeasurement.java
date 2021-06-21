package net.airqo.models;

import java.io.Serializable;
import java.util.HashMap;

public class TransformedMeasurement implements Serializable {

    private String frequency = "raw";
    private Integer channelID = null;
    private String time = "";
    private String tenant = "";
    private String device = "";
    private TransformedLocation location = new TransformedLocation();

    private TransformedValue internalTemperature = new TransformedValue();
    private TransformedValue internalHumidity = new TransformedValue();
    private TransformedValue externalTemperature = new TransformedValue();
    private TransformedValue externalPressure = new TransformedValue();
    private TransformedValue externalHumidity = new TransformedValue();
    private TransformedValue altitude = new TransformedValue();
    private TransformedValue battery = new TransformedValue();
    private TransformedValue speed = new TransformedValue();
    private TransformedValue satellites = new TransformedValue();
    private TransformedValue hdop = new TransformedValue();
    private TransformedValue pm10 = new TransformedValue();
    private TransformedValue pm2_5 = new TransformedValue();
    private TransformedValue s2_pm10 = new TransformedValue();
    private TransformedValue s2_pm2_5 = new TransformedValue();
    private TransformedValue no2 = new TransformedValue();
    private TransformedValue pm1 = new TransformedValue();

    public String getFrequency() {
        return frequency;
    }

    public void setFrequency(String frequency) {
        this.frequency = frequency;
    }

    public Integer getChannelID() {
        return channelID;
    }

    public void setChannelID(Integer channelID) {
        this.channelID = channelID;
    }

    public String getTime() {
        return time;
    }

    public void setTime(String time) {
        this.time = time;
    }

    public String getTenant() {
        return tenant;
    }

    public void setTenant(String tenant) {
        this.tenant = tenant;
    }

    public String getDevice() {
        return device;
    }

    public void setDevice(String device) {
        this.device = device;
    }

    public TransformedLocation getLocation() {
        return location;
    }

    public void setLocation(TransformedLocation location) {
        this.location = location;
    }

    public TransformedValue getInternalTemperature() {
        return internalTemperature;
    }

    public void setInternalTemperature(TransformedValue internalTemperature) {
        this.internalTemperature = internalTemperature;
    }

    public TransformedValue getInternalHumidity() {
        return internalHumidity;
    }

    public void setInternalHumidity(TransformedValue internalHumidity) {
        this.internalHumidity = internalHumidity;
    }

    public TransformedValue getExternalTemperature() {
        return externalTemperature;
    }

    public void setExternalTemperature(TransformedValue externalTemperature) {
        this.externalTemperature = externalTemperature;
    }

    public TransformedValue getExternalPressure() {
        return externalPressure;
    }

    public void setExternalPressure(TransformedValue externalPressure) {
        this.externalPressure = externalPressure;
    }

    public TransformedValue getExternalHumidity() {
        return externalHumidity;
    }

    public void setExternalHumidity(TransformedValue externalHumidity) {
        this.externalHumidity = externalHumidity;
    }

    public TransformedValue getAltitude() {
        return altitude;
    }

    public void setAltitude(TransformedValue altitude) {
        this.altitude = altitude;
    }

    public TransformedValue getBattery() {
        return battery;
    }

    public void setBattery(TransformedValue battery) {
        this.battery = battery;
    }

    public TransformedValue getSpeed() {
        return speed;
    }

    public void setSpeed(TransformedValue speed) {
        this.speed = speed;
    }

    public TransformedValue getSatellites() {
        return satellites;
    }

    public void setSatellites(TransformedValue satellites) {
        this.satellites = satellites;
    }

    public TransformedValue getHdop() {
        return hdop;
    }

    public void setHdop(TransformedValue hdop) {
        this.hdop = hdop;
    }

    public TransformedValue getPm10() {
        return pm10;
    }

    public void setPm10(TransformedValue pm10) {
        this.pm10 = pm10;
    }

    public TransformedValue getPm2_5() {
        return pm2_5;
    }

    public void setPm2_5(TransformedValue pm2_5) {
        this.pm2_5 = pm2_5;
    }

    public TransformedValue getS2_pm10() {
        return s2_pm10;
    }

    public void setS2_pm10(TransformedValue s2_pm10) {
        this.s2_pm10 = s2_pm10;
    }

    public TransformedValue getS2_pm2_5() {
        return s2_pm2_5;
    }

    public void setS2_pm2_5(TransformedValue s2_pm2_5) {
        this.s2_pm2_5 = s2_pm2_5;
    }

    public TransformedValue getNo2() {
        return no2;
    }

    public void setNo2(TransformedValue no2) {
        this.no2 = no2;
    }

    public TransformedValue getPm1() {
        return pm1;
    }

    public void setPm1(TransformedValue pm1) {
        this.pm1 = pm1;
    }
}
