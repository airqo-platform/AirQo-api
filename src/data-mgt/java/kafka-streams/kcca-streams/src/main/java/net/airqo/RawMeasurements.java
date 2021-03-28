package net.airqo;

import java.util.ArrayList;
import java.util.HashMap;

public class RawMeasurements {

    private String id;
    private String time;
    private String device;
    private String deviceCode;
    private HashMap<String, Float> location;
    private ArrayList<HashMap<String, HashMap<String, Float>>> measurements;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
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

    public String getDeviceCode() {
        return deviceCode;
    }

    public void setDeviceCode(String deviceCode) {
        this.deviceCode = deviceCode;
    }

    public HashMap<String, Float> getLocation() {
        return location;
    }

    public void setLocation(HashMap<String, Float> location) {
        this.location = location;
    }

    public ArrayList<HashMap<String, HashMap<String, Float>>> getMeasurements() {
        return measurements;
    }

    public void setMeasurements(ArrayList<HashMap<String, HashMap<String, Float>>> measurements) {
        this.measurements = measurements;
    }
}
