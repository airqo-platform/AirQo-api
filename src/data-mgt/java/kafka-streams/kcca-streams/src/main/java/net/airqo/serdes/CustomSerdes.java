package net.airqo.serdes;

import net.airqo.models.RawMeasurements;
import net.airqo.models.TransformedMeasurements;
import net.airqo.serializers.JsonDeserializer;
import net.airqo.serializers.JsonSerializer;
import org.apache.kafka.common.serialization.Serde;
import org.apache.kafka.common.serialization.Serdes;

public class CustomSerdes {

    static public final class RawMeasurementsSerde extends Serdes.WrapperSerde<RawMeasurements> {
        public RawMeasurementsSerde() {
            super(new JsonSerializer<>(), new JsonDeserializer<>(RawMeasurements.class));
        }
    }

    static public final class TransformedMeasurementsSerde extends Serdes.WrapperSerde<TransformedMeasurements> {
        public TransformedMeasurementsSerde() {
            super(new JsonSerializer<>(), new JsonDeserializer<>(TransformedMeasurements.class));
        }
    }

    public static Serde<RawMeasurements> RawMeasurements() {
        return new CustomSerdes.RawMeasurementsSerde();
    }

    public static Serde<TransformedMeasurements> TransformedMeasurements() { return new TransformedMeasurementsSerde(); }
}
