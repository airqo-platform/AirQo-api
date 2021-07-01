package net.airqo.connectors.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.apache.kafka.connect.data.Schema;
import org.apache.kafka.connect.data.SchemaBuilder;

import java.io.Serializable;
import java.util.HashMap;

@JsonIgnoreProperties(ignoreUnknown = true)
public class RawMeasurements implements Serializable {

    private String _id;
    private String recId;
    private String time;
    private String device;
    private String deviceCode;
    private String average = "raw";
    private HashMap<String, Object> location;
    private HashMap<String, HashMap<String, Double>> characteristics;

    public String getAverage() {
        return average;
    }

    public void setAverage(String average) {
        this.average = average;
    }

    public String get_id() {
        return _id;
    }

    public void set_id(String _id) {
        this._id = _id;
    }

    public String getRecId() {
        return recId;
    }

    public void setRecId(String recId) {
        this.recId = recId;
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

    public HashMap<String, Object> getLocation() {
        return location;
    }

    public void setLocation(HashMap<String, Object> location) {
        this.location = location;
    }

    public HashMap<String, HashMap<String, Double>> getCharacteristics() {
        return characteristics;
    }

    public void setCharacteristics(HashMap<String, HashMap<String, Double>> characteristics) {
        this.characteristics = characteristics;
    }
}
