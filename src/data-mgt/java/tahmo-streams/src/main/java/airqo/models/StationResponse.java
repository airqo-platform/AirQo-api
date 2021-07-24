package airqo.models;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class StationResponse {

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Serie{

        String name;
        List<String> columns;
        List<List<Object>> values;

        @Override
        public String toString() {
            return "Serie{" +
                    "name='" + name + '\'' +
                    ", columns=" + columns +
                    ", values=" + values +
                    '}';
        }
    }

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Result{

        @JsonAlias({"statement_id"})
        private String statementId;
        List<Serie> series;

        @Override
        public String toString() {
            return "Result{" +
                    "statementId='" + statementId + '\'' +
                    ", series=" + series +
                    '}';
        }
    }

    private List<Result> results;

    @Override
    public String toString() {
        return "StationResponse{" +
                "results=" + results +
                '}';
    }
}
