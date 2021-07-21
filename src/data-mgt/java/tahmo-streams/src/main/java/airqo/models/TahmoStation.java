package airqo.models;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class TahmoStation {

    @JsonAlias({ "code" })
    private String code = "";

    @Override
    public String toString() {
        return "TahmoStation{" +
                "code='" + code + '\'' +
                '}';
    }
}
