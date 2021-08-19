package airqo.models;

import airqo.StationDataDeserializer;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonDeserialize(using = StationDataDeserializer.class)
public class StationData {

    List<StationMeasurement> measurements = new ArrayList<>();

    public StationData(List<StationMeasurement> measurements) {
        this.measurements = measurements;
    }

    public StationData() {
    }
}
