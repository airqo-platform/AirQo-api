package airqo.models;

import airqo.Variable;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

import java.util.Date;
import java.util.List;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class StationMeasurement2 {

    public StationMeasurement2(Date time, Double value, Variable variable) {
        this.time = time;
        this.value = value;
        this.variable = variable;
    }

    Date time;
    Double value;
    Variable variable;

    @Override
    public String toString() {
        return "StationMeasurement{" +
                "time=" + time +
                ", value=" + value +
                ", variable=" + variable +
                '}';
    }
}
