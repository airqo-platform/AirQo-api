package purpleAir;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

import java.io.Serializable;
import java.util.List;

@Getter
@Setter
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class PurpleAirData implements Serializable {

    private Long time_stamp;
    private List<String> fields;
    private List<List<Object>> data;

}
