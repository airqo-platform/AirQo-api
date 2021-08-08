package airqo;

import airqo.models.StationData;
import airqo.models.StationMeasurement;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
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

        ObjectMapper mapper = new ObjectMapper();

        JsonNode node = jsonParser.getCodec().readTree(jsonParser);
        List<JsonNode> resultsArray = node.findValues("results" );
        List<JsonNode> seriesArray = resultsArray.get(0).findValues("series" );

        JsonNode columnsNode = seriesArray.get(0).findValues("columns").get(0);
        ObjectReader columnsReader = mapper.readerFor(new TypeReference<List<String>>() {
        });
        List<String> columnsArray = columnsReader.readValue(columnsNode);

        JsonNode valuesNode = seriesArray.get(0).findValues("values").get(0);
        ObjectReader valuesReader = mapper.readerFor(new TypeReference<List<List<Object>>>() {
        });
        List<List<Object>> valuesArray = valuesReader.readValue(valuesNode);

        int variablePosition = columnsArray.indexOf("variable");
        int valuePosition = columnsArray.indexOf("value");
        int timePosition = columnsArray.indexOf("time");
        int stationPosition = columnsArray.indexOf("station");

        List<StationMeasurement> stationMeasurements = new ArrayList<>();

        for (List<Object> nodeObject : valuesArray) {

            String variable = String.valueOf(nodeObject.get(variablePosition));
            if (variable.equalsIgnoreCase("te") || variable.equalsIgnoreCase("rh")) {

                StationMeasurement stationData = new StationMeasurement();
                stationData.setCode(String.valueOf(nodeObject.get(stationPosition)));

                if (variable.equalsIgnoreCase("te"))
                    stationData.setTemperature(Double.parseDouble(String.valueOf(nodeObject.get(valuePosition))));
                else
                    stationData.setHumidity(Double.parseDouble(String.valueOf(nodeObject.get(valuePosition))));

                try {
                    stationData.setTime(dateFormat.parse(String.valueOf(nodeObject.get(timePosition))));
                } catch (ParseException e) {
                    e.printStackTrace();
                }

                if (stationData.isNotNull()) {
                    stationMeasurements.add(stationData);
                }
            }
        }
        System.out.println("Measurements : " + stationMeasurements);
        return new StationData(stationMeasurements);
    }
}
