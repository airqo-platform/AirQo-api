package airqo;

import airqo.models.StationData;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;

import java.io.IOException;
import java.util.List;

public class StationDataDeserializer extends StdDeserializer<StationData> {
    
    protected StationDataDeserializer(Class<?> vc) {
        super(vc);
    }

    @Override
    public StationData deserialize(JsonParser jsonParser, DeserializationContext deserializationContext)
            throws IOException, JsonProcessingException {

        JsonNode node = jsonParser.getCodec().readTree(jsonParser);
        List<JsonNode> results = node.findValues("results" );
        String answer = node.get("faqAnswer").asText();

        return null;
    }
}
