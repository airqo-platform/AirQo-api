package airqo.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class AirQoDevicesResponse {

    private boolean success = false;
    private List<AirqoDevice> devices = new ArrayList<>();

    @Override
    public String toString() {
        return "AirQoDevicesResponse{" +
                "success=" + success +
                ", devices=" + devices +
                '}';
    }
}
