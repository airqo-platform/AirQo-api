package net.airqo.serdes;

import net.airqo.models.RawKccaMeasurement;
import net.airqo.models.TransformedMeasurement;
import net.airqo.serializers.JsonDeserializer;
import net.airqo.serializers.JsonSerializer;
import org.apache.kafka.common.serialization.Serde;
import org.apache.kafka.common.serialization.Serdes;

public class CustomSerdes {

    static public final class RawMeasurementsSerde extends Serdes.WrapperSerde<RawKccaMeasurement> {
        public RawMeasurementsSerde() {
            super(new JsonSerializer<>(), new JsonDeserializer<>(RawKccaMeasurement.class));
        }
    }

    static public final class TransformedMeasurementsSerde extends Serdes.WrapperSerde<TransformedMeasurement> {
        public TransformedMeasurementsSerde() {
            super(new JsonSerializer<>(), new JsonDeserializer<>(TransformedMeasurement.class));
        }
    }

    public static Serde<RawKccaMeasurement> RawMeasurements() {
        return new CustomSerdes.RawMeasurementsSerde();
    }

    public static Serde<TransformedMeasurement> TransformedMeasurements() {
        return new CustomSerdes.TransformedMeasurementsSerde(); }
}
