package airqo;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
public class TransformedMeasurement implements Serializable {

    private String frequency;
    private String siteId;
    private Integer deviceNumber;
    private String time;
    private String tenant;
    private String device;
    private String deviceId;
    private TransformedLocation location;

    private TransformedValue internalTemperature;
    private TransformedValue internalHumidity ;
    private TransformedValue externalTemperature;
    private TransformedValue externalPressure;
    private TransformedValue externalHumidity;
    private TransformedValue altitude;
    private TransformedValue battery;
    private TransformedValue speed;
    private TransformedValue satellites;
    private TransformedValue hdop;
    private TransformedValue pm10;
    private TransformedValue pm2_5;
    private TransformedValue s2_pm10;
    private TransformedValue s2_pm2_5;
    private TransformedValue no2;
    private TransformedValue pm1;

    public TransformedMeasurement(String frequency, String siteId, Integer deviceNumber, String time, String tenant, String device, String deviceId, TransformedLocation location, TransformedValue internalTemperature, TransformedValue internalHumidity, TransformedValue externalTemperature, TransformedValue externalPressure, TransformedValue externalHumidity, TransformedValue altitude, TransformedValue battery, TransformedValue speed, TransformedValue satellites, TransformedValue hdop, TransformedValue pm10, TransformedValue pm2_5, TransformedValue s2_pm10, TransformedValue s2_pm2_5, TransformedValue no2, TransformedValue pm1) {
        this.frequency = frequency;
        this.siteId = siteId;
        this.deviceNumber = deviceNumber;
        this.time = time;
        this.tenant = tenant;
        this.device = device;
        this.deviceId = deviceId;
        this.location = location;
        this.internalTemperature = internalTemperature;
        this.internalHumidity = internalHumidity;
        this.externalTemperature = externalTemperature;
        this.externalPressure = externalPressure;
        this.externalHumidity = externalHumidity;
        this.altitude = altitude;
        this.battery = battery;
        this.speed = speed;
        this.satellites = satellites;
        this.hdop = hdop;
        this.pm10 = pm10;
        this.pm2_5 = pm2_5;
        this.s2_pm10 = s2_pm10;
        this.s2_pm2_5 = s2_pm2_5;
        this.no2 = no2;
        this.pm1 = pm1;
    }

    @Override
    public String toString() {
        return "TransformedMeasurement{" +
                "frequency='" + frequency + '\'' +
                ", siteId='" + siteId + '\'' +
                ", deviceNumber=" + deviceNumber +
                ", time='" + time + '\'' +
                ", tenant='" + tenant + '\'' +
                ", device='" + device + '\'' +
                ", deviceId='" + deviceId + '\'' +
                ", location=" + location +
                ", internalTemperature=" + internalTemperature +
                ", internalHumidity=" + internalHumidity +
                ", externalTemperature=" + externalTemperature +
                ", externalPressure=" + externalPressure +
                ", externalHumidity=" + externalHumidity +
                ", altitude=" + altitude +
                ", battery=" + battery +
                ", speed=" + speed +
                ", satellites=" + satellites +
                ", hdop=" + hdop +
                ", pm10=" + pm10 +
                ", pm2_5=" + pm2_5 +
                ", s2_pm10=" + s2_pm10 +
                ", s2_pm2_5=" + s2_pm2_5 +
                ", no2=" + no2 +
                ", pm1=" + pm1 +
                '}';
    }
}
