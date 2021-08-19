package airqo.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class SitesResponse {

    private boolean success = false;
    private List<Site> sites = new ArrayList<>();

    @Override
    public String toString() {
        return "SitesResponse{" +
                "success=" + success +
                ", sites=" + sites +
                '}';
    }
}
