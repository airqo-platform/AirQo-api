package net.airqo;

import java.util.HashMap;

public class TransformedMeasurements {

    private String frequency;
    private String time;
    private String device;
    private HashMap<String, HashMap<String, Double>> location;
    private HashMap<String, Double> internalTemperature;
    private HashMap<String, Double> internalHumidity;
    private HashMap<String, Double> pm10;
    private HashMap<String, Double> pm2_5;
    private HashMap<String, Double> no2;
    private HashMap<String, Double> pm1;

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

    public HashMap<String, HashMap<String, Double>> getLocation() {
        return location;
    }

    public void setLocation(HashMap<String, HashMap<String, Double>> location) {
        this.location = location;
    }

    public HashMap<String, Double> getInternalTemperature() {
        return internalTemperature;
    }

    public void setInternalTemperature(HashMap<String, Double> internalTemperature) {
        this.internalTemperature = internalTemperature;
    }

    public HashMap<String, Double> getInternalHumidity() {
        return internalHumidity;
    }

    public void setInternalHumidity(HashMap<String, Double> internalHumidity) {
        this.internalHumidity = internalHumidity;
    }

    public HashMap<String, Double> getPm10() {
        return pm10;
    }

    public void setPm10(HashMap<String, Double> pm10) {
        this.pm10 = pm10;
    }

    public HashMap<String, Double> getPm2_5() {
        return pm2_5;
    }

    public void setPm2_5(HashMap<String, Double> pm2_5) {
        this.pm2_5 = pm2_5;
    }

    public HashMap<String, Double> getNo2() {
        return no2;
    }

    public void setNo2(HashMap<String, Double> no2) {
        this.no2 = no2;
    }

    public HashMap<String, Double> getPm1() {
        return pm1;
    }

    public void setPm1(HashMap<String, Double> pm1) {
        this.pm1 = pm1;
    }

    //    public HashMap<String, HashMap<String, Double>> getMeasurements() {
//        return measurements;
//    }
//
//    public void setMeasurements(HashMap<String, HashMap<String, Double>> measurements) {
//        this.measurements = measurements;
//    }
}
