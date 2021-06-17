package net.airqo.models;

import java.util.HashMap;

public class TransformedMeasurement {

    private String frequency = "raw";
    private int channelID = 0;
    private String time = "";
    private String tenant = "";
    private String device = "";
    private HashMap<String, HashMap<String, Object>> location = new HashMap<String, HashMap<String, Object>>(){{
        put("latitude", new HashMap<String, Object>(){{
            put("value", null);
        }});
        put("longitude", new HashMap<String, Object>(){{
            put("value", null);
        }});
    }};
    private HashMap<String, Object> internalTemperature = setDefaults();
    private HashMap<String, Object> internalHumidity = setDefaults();
    private HashMap<String, Object> externalTemperature = setDefaults();
    private HashMap<String, Object> externalPressure = setDefaults();
    private HashMap<String, Object> externalHumidity = setDefaults();
    private HashMap<String, Object> altitude = setDefaults();
    private HashMap<String, Object> battery = setDefaults();
    private HashMap<String, Object> speed = setDefaults();
    private HashMap<String, Object> satellites = setDefaults();
    private HashMap<String, Object> hdop = setDefaults();
    private HashMap<String, Object> pm10 = setDefaults();
    private HashMap<String, Object> pm2_5 = setDefaults();
    private HashMap<String, Object> s2_pm10 = setDefaults();
    private HashMap<String, Object> s2_pm2_5 = setDefaults();
    private HashMap<String, Object> no2 = setDefaults();
    private HashMap<String, Object> pm1 = setDefaults();

    private HashMap<String, Object> setDefaults(){
        return  new HashMap<String, Object>(){{
            put("calibratedValue", null);
            put("value", null);
            put("standardDeviationValue", null);
            put("uncertaintyValue", null);
        }};
    }

    public HashMap<String, Object> getExternalTemperature() {
        return externalTemperature;
    }

    public void setExternalTemperature(HashMap<String, Object> externalTemperature) {
        this.externalTemperature = externalTemperature;
    }

    public HashMap<String, Object> getExternalPressure() {
        return externalPressure;
    }

    public void setExternalPressure(HashMap<String, Object> externalPressure) {
        this.externalPressure = externalPressure;
    }

    public HashMap<String, Object> getExternalHumidity() {
        return externalHumidity;
    }

    public void setExternalHumidity(HashMap<String, Object> externalHumidity) {
        this.externalHumidity = externalHumidity;
    }

    public int getChannelID() {
        return channelID;
    }

    public void setChannelID(int channelID) {
        this.channelID = channelID;
    }

    public HashMap<String, Object> getAltitude() {
        return altitude;
    }

    public void setAltitude(HashMap<String, Object> altitude) {
        this.altitude = altitude;
    }

    public HashMap<String, Object> getBattery() {
        return battery;
    }

    public void setBattery(HashMap<String, Object> battery) {
        this.battery = battery;
    }

    public HashMap<String, Object> getSpeed() {
        return speed;
    }

    public void setSpeed(HashMap<String, Object> speed) {
        this.speed = speed;
    }

    public HashMap<String, Object> getSatellites() {
        return satellites;
    }

    public void setSatellites(HashMap<String, Object> satellites) {
        this.satellites = satellites;
    }

    public HashMap<String, Object> getHdop() {
        return hdop;
    }

    public void setHdop(HashMap<String, Object> hdop) {
        this.hdop = hdop;
    }

    public HashMap<String, Object> getS2_pm10() {
        return s2_pm10;
    }

    public void setS2_pm10(HashMap<String, Object> s2_pm10) {
        this.s2_pm10 = s2_pm10;
    }

    public HashMap<String, Object> getS2_pm2_5() {
        return s2_pm2_5;
    }

    public void setS2_pm2_5(HashMap<String, Object> s2_pm2_5) {
        this.s2_pm2_5 = s2_pm2_5;
    }

    public String getTenant() {
        return tenant;
    }

    public void setTenant(String tenant) {
        this.tenant = tenant;
    }

    public String getFrequency() {
        return frequency;
    }

    public void setFrequency(String frequency) {
        this.frequency = frequency;
    }

    public String getTime() {
        return time;
    }

    public void setTime(String time) {
        this.time = time;
    }

    public String getDevice() {
        return device;
    }

    public void setDevice(String device) {
        this.device = device;
    }

    public HashMap<String, HashMap<String, Object>> getLocation() {
        return location;
    }

    public void setLocation(HashMap<String, HashMap<String, Object>> location) {
        this.location = location;
    }

    public HashMap<String, Object> getInternalTemperature() {
        return internalTemperature;
    }

    public void setInternalTemperature(HashMap<String, Object> internalTemperature) {
        this.internalTemperature = internalTemperature;
    }

    public HashMap<String, Object> getInternalHumidity() {
        return internalHumidity;
    }

    public void setInternalHumidity(HashMap<String, Object> internalHumidity) {
        this.internalHumidity = internalHumidity;
    }

    public HashMap<String, Object> getPm10() {
        return pm10;
    }

    public void setPm10(HashMap<String, Object> pm10) {
        this.pm10 = pm10;
    }

    public HashMap<String, Object> getPm2_5() {
        return pm2_5;
    }

    public void setPm2_5(HashMap<String, Object> pm2_5) {
        this.pm2_5 = pm2_5;
    }

    public HashMap<String, Object> getNo2() {
        return no2;
    }

    public void setNo2(HashMap<String, Object> no2) {
        this.no2 = no2;
    }

    public HashMap<String, Object> getPm1() {
        return pm1;
    }

    public void setPm1(HashMap<String, Object> pm1) {
        this.pm1 = pm1;
    }

    //    public HashMap<String, HashMap<String, Object>> getMeasurements() {
//        return measurements;
//    }
//
//    public void setMeasurements(HashMap<String, HashMap<String, Object>> measurements) {
//        this.measurements = measurements;
//    }
}
