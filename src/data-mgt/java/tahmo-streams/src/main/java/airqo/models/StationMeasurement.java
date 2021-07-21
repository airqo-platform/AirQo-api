package airqo.models;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class StationMeasurement {

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class SerieData{
        String time;
        String quality;
        String sensor;
        String station;
        String value;
        String variable;

    }

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class StationSerie{

        String name;
        List<SerieData> data;
    }

    private String statementId;
    private List<StationSerie> series;

}
