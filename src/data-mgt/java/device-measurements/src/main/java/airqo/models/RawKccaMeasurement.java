package airqo.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.io.Serializable;

@JsonIgnoreProperties(ignoreUnknown = true)
public class RawKccaMeasurement implements Serializable {

    private String _id = "";
    private String time = "";
    private String device = "";
    private String average = "raw";
    private String deviceCode = "";
    private KccaLocation location = new KccaLocation();
    private KccaXtics characteristics = new KccaXtics();

    public RawKccaMeasurement() {
    }

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

    public KccaLocation getLocation() {
        return location;
    }

    public void setLocation(KccaLocation location) {
        this.location = location;
    }

    public KccaXtics getCharacteristics() {
        return characteristics;
    }

    public void setCharacteristics(KccaXtics characteristics) {
        this.characteristics = characteristics;
    }
}
