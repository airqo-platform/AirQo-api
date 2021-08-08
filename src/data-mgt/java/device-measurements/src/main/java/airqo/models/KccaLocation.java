package airqo.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class KccaLocation implements Serializable {

    List<Double> coordinates = new ArrayList<>();
    String type = "Point";

    @Override
    public String toString() {
        return "KccaLocation{" +
                "coordinates=" + coordinates +
                ", type='" + type + '\'' +
                '}';
    }
}
