package net.airqo;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.ArrayList;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class KccaDevice {

    public static class Location{
        List<Double> coordinates = new ArrayList<>();
        String type = "";

        @Override
        public String toString() {
            return "Location{" +
                    "coordinates=" + coordinates +
                    ", type='" + type + '\'' +
                    '}';
        }

        public List<Double> getCoordinates() {
            return coordinates;
        }

        public void setCoordinates(List<Double> coordinates) {
            this.coordinates = coordinates;
        }

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }
    }

    String _id = "";
    String code = "";
    String lifeStage = "";
    String workingStartAt = "";
    String lastReadingReceivedAt = "";
    String batteryStatus;
    String signalStrength;
    String overallStatus;
    String sensorsHealthStatus;
    Double latestBatteryVoltage;
    Double batteryPercentage;
    Double rssi;
    Integer roadDistance;
    Boolean indoor;
    Integer aglHeight;
    Location location = new Location();
    List<String> enabledCharacteristics = new ArrayList<>();

    @Override
    public String toString() {
        return "KccaDevice{" +
                "_id='" + _id + '\'' +
                ", code='" + code + '\'' +
                ", lifeStage='" + lifeStage + '\'' +
                ", workingStartAt='" + workingStartAt + '\'' +
                ", lastReadingReceivedAt='" + lastReadingReceivedAt + '\'' +
                ", batteryStatus='" + batteryStatus + '\'' +
                ", signalStrength='" + signalStrength + '\'' +
                ", overallStatus='" + overallStatus + '\'' +
                ", sensorsHealthStatus='" + sensorsHealthStatus + '\'' +
                ", latestBatteryVoltage=" + latestBatteryVoltage +
                ", batteryPercentage=" + batteryPercentage +
                ", rssi=" + rssi +
                ", roadDistance=" + roadDistance +
                ", indoor=" + indoor +
                ", aglHeight=" + aglHeight +
                ", location=" + location +
                ", enabledCharacteristics=" + enabledCharacteristics +
                '}';
    }

    public String get_id() {
        return _id;
    }

    public void set_id(String _id) {
        this._id = _id;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getLifeStage() {
        return lifeStage;
    }

    public void setLifeStage(String lifeStage) {
        this.lifeStage = lifeStage;
    }

    public String getWorkingStartAt() {
        return workingStartAt;
    }

    public void setWorkingStartAt(String workingStartAt) {
        this.workingStartAt = workingStartAt;
    }

    public String getLastReadingReceivedAt() {
        return lastReadingReceivedAt;
    }

    public void setLastReadingReceivedAt(String lastReadingReceivedAt) {
        this.lastReadingReceivedAt = lastReadingReceivedAt;
    }

    public String getBatteryStatus() {
        return batteryStatus;
    }

    public void setBatteryStatus(String batteryStatus) {
        this.batteryStatus = batteryStatus;
    }

    public String getSignalStrength() {
        return signalStrength;
    }

    public void setSignalStrength(String signalStrength) {
        this.signalStrength = signalStrength;
    }

    public String getOverallStatus() {
        return overallStatus;
    }

    public void setOverallStatus(String overallStatus) {
        this.overallStatus = overallStatus;
    }

    public String getSensorsHealthStatus() {
        return sensorsHealthStatus;
    }

    public void setSensorsHealthStatus(String sensorsHealthStatus) {
        this.sensorsHealthStatus = sensorsHealthStatus;
    }

    public Double getLatestBatteryVoltage() {
        return latestBatteryVoltage;
    }

    public void setLatestBatteryVoltage(Double latestBatteryVoltage) {
        this.latestBatteryVoltage = latestBatteryVoltage;
    }

    public Double getBatteryPercentage() {
        return batteryPercentage;
    }

    public void setBatteryPercentage(Double batteryPercentage) {
        this.batteryPercentage = batteryPercentage;
    }

    public Double getRssi() {
        return rssi;
    }

    public void setRssi(Double rssi) {
        this.rssi = rssi;
    }

    public Integer getRoadDistance() {
        return roadDistance;
    }

    public void setRoadDistance(Integer roadDistance) {
        this.roadDistance = roadDistance;
    }

    public Boolean getIndoor() {
        return indoor;
    }

    public void setIndoor(Boolean indoor) {
        this.indoor = indoor;
    }

    public Integer getAglHeight() {
        return aglHeight;
    }

    public void setAglHeight(Integer aglHeight) {
        this.aglHeight = aglHeight;
    }

    public Location getLocation() {
        return location;
    }

    public void setLocation(Location location) {
        this.location = location;
    }

    public List<String> getEnabledCharacteristics() {
        return enabledCharacteristics;
    }

    public void setEnabledCharacteristics(List<String> enabledCharacteristics) {
        this.enabledCharacteristics = enabledCharacteristics;
    }
}

