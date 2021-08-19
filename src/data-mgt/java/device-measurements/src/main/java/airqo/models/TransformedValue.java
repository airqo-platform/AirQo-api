package airqo.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@JsonIgnoreProperties(ignoreUnknown = true)
@Setter
@Getter
public class TransformedValue implements Serializable {

    private Double value;
    private Double calibratedValue;
    private Double standardDeviationValue;
    private Double uncertaintyValue;

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
