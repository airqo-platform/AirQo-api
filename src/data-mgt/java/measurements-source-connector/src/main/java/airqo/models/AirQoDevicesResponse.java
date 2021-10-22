package airqo.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class AirQoDevicesResponse {

    private boolean success = false;
    private List<AirqoDevice> devices = new ArrayList<>();

}
