package airqo.models;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
public class TransformedMeasurement implements Serializable {

    private String frequency = "raw";
    private String siteId = "";
    private Integer deviceNumber = 0;
    private String time = "";
    private String tenant = "";
    private String device = "";
    private String deviceId = "";
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
