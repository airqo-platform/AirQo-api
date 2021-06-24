package net.airqo.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.ArrayList;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class AirQoDevicesResponse {

    private boolean success = false;
    private List<AirqoDevice> devices = new ArrayList<>();

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public List<AirqoDevice> getDevices() {
        return devices;
    }

    public void setDevices(List<AirqoDevice> devices) {
        this.devices = devices;
    }
}
