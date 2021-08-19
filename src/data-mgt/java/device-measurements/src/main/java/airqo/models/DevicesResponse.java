package airqo.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Setter
@Getter
@JsonIgnoreProperties(ignoreUnknown = true)
public class DevicesResponse {

    private boolean success = false;
    private List<Device> devices = new ArrayList<>();

    @Override
    public String toString() {
        return "DevicesResponse{" +
                "success=" + success +
                ", devices=" + devices +
                '}';
    }
}