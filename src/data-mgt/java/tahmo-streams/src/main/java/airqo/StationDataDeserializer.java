package airqo;

import airqo.models.StationData;
import airqo.models.StationMeasurement;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;

import java.io.IOException;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class StationDataDeserializer extends StdDeserializer<StationData> {

    public static SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd'T'hh:mm:ss'Z'");

    public StationDataDeserializer() {
        this(null);
    }

    protected StationDataDeserializer(Class<?> vc) {
        super(vc);
    }

    @Override
    public StationData deserialize(JsonParser jsonParser, DeserializationContext deserializationContext)
            throws IOException, JsonProcessingException {

        JsonNode node = jsonParser.getCodec().readTree(jsonParser);
        List<JsonNode> resultsArray = node.findValues("results" );
        List<JsonNode> seriesArray = resultsArray.get(0).findValues("series" );
//        List<JsonNode> columnsArray = seriesArray.get(0).findValues("columns" );
        List<String> columnsArray = seriesArray.get(0).findValuesAsText("columns" );
        List<JsonNode> valuesArray = seriesArray.get(0).findValues("values" );

        int variablePosition = columnsArray.indexOf("variable");
        int valuePosition = columnsArray.indexOf("value");
        int timePosition = columnsArray.indexOf("time");
        int stationPosition = columnsArray.indexOf("station");

        List<StationMeasurement> stationMeasurements = new ArrayList<>();

        for (JsonNode nodeObject : valuesArray) {
            List<Object> values = Collections.singletonList(nodeObject);

            String variable = (String) values.get(variablePosition);
            if (variable.equalsIgnoreCase("te") || variable.equalsIgnoreCase("rh")) {

                StationMeasurement stationData = new StationMeasurement();
                stationData.setCode((String) values.get(stationPosition));

                if (variable.equalsIgnoreCase("te"))
                    stationData.setTemperature(Double.parseDouble(String.valueOf(values.get(valuePosition))));
                else
                    stationData.setHumidity(Double.parseDouble(String.valueOf(values.get(valuePosition))));

                try {
                    stationData.setTime(dateFormat.parse(String.valueOf(values.get(timePosition))));
                } catch (ParseException e) {
                    e.printStackTrace();
                }

                if (stationData.isNotNull()) {
                    stationMeasurements.add(stationData);
                }
            }
        }
        return new StationData(stationMeasurements);
    }
}
