package net.airqo.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class KccaXticValue {

    private Double value;
    private Double calibratedValue;
    private Double raw;
    private Integer weight;

    public Double getValue() {
        return value;
    }

    public void setValue(Double value) {
        this.value = value;
    }

    public Double getCalibratedValue() {
        if(calibratedValue == null)
            return this.getValue();
        return calibratedValue;
    }

    public void setCalibratedValue(Double calibratedValue) {
        this.calibratedValue = calibratedValue;
    }

    public Double getRaw() {
        return raw;
    }

    public void setRaw(Double raw) {
        this.raw = raw;
    }

    public Integer getWeight() {
        return weight;
    }

    public void setWeight(Integer weight) {
        this.weight = weight;
    }
}
