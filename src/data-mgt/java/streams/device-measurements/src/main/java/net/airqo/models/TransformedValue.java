package net.airqo.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.io.Serializable;

@JsonIgnoreProperties(ignoreUnknown = true)
public class TransformedValue implements Serializable {

    private Double value;
    private Double calibratedValue;
    private Double standardDeviationValue;
    private Double uncertaintyValue;

    public Double getValue() {
        return value;
    }

    public void setValue(Double value) {
        this.value = value;
    }

    public Double getCalibratedValue() {
        return calibratedValue;
    }

    public void setCalibratedValue(Double calibratedValue) {
        this.calibratedValue = calibratedValue;
    }

    public Double getStandardDeviationValue() {
        return standardDeviationValue;
    }

    public void setStandardDeviationValue(Double standardDeviationValue) {
        this.standardDeviationValue = standardDeviationValue;
    }

    public Double getUncertaintyValue() {
        return uncertaintyValue;
    }

    public void setUncertaintyValue(Double uncertaintyValue) {
        this.uncertaintyValue = uncertaintyValue;
    }
}
