package net.airqo;

import java.util.ArrayList;
import java.util.HashMap;

public class TransformedMeasurements {

    private String frequency;
    private String time;
    private String device;
    private HashMap<String, Double> location;
    private ArrayList<HashMap<String, HashMap<String, Double>>> measurements;

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

    public HashMap<String, Double> getLocation() {
        return location;
    }

    public void setLocation(HashMap<String, Double> location) {
        this.location = location;
    }

    public ArrayList<HashMap<String, HashMap<String, Double>>> getMeasurements() {
        return measurements;
    }

    public void setMeasurements(ArrayList<HashMap<String, HashMap<String, Double>>> measurements) {
        this.measurements = measurements;
    }
}
