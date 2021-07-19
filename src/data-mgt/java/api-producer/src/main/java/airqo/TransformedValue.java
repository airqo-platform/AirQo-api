package airqo;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class TransformedValue implements Serializable {

    private Double value;
    private Double calibratedValue;
    private Double standardDeviationValue;
    private Double uncertaintyValue;

    public TransformedValue(Double value, Double calibratedValue, Double standardDeviationValue, Double uncertaintyValue) {
        this.value = value;
        this.calibratedValue = calibratedValue;
        this.standardDeviationValue = standardDeviationValue;
        this.uncertaintyValue = uncertaintyValue;
    }

    @Override
    public String toString() {
        return "TransformedValue{" +
                "value=" + value +
                ", calibratedValue=" + calibratedValue +
                ", standardDeviationValue=" + standardDeviationValue +
                ", uncertaintyValue=" + uncertaintyValue +
                '}';
    }
}
