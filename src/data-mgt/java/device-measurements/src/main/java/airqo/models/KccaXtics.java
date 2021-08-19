package airqo.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class KccaXtics {

    private KccaXticValue relHumid = new KccaXticValue();
    private KccaXticValue temperature = new KccaXticValue();
    private KccaXticValue no2Conc = new KccaXticValue();
    private KccaXticValue pm2_5ConcNum = new KccaXticValue();
    private KccaXticValue pm2_5ConcMass = new KccaXticValue();
    private KccaXticValue pm1ConcNum = new KccaXticValue();
    private KccaXticValue pm1ConcMass = new KccaXticValue();
    private KccaXticValue pm10ConcNum = new KccaXticValue();
    private KccaXticValue pm10ConcMass = new KccaXticValue();
    
    @Override
    public String toString() {
        return "KccaXtics{" +
                "relHumid=" + relHumid +
                ", temperature=" + temperature +
                ", no2Conc=" + no2Conc +
                ", pm2_5ConcNum=" + pm2_5ConcNum +
                ", pm2_5ConcMass=" + pm2_5ConcMass +
                ", pm1ConcNum=" + pm1ConcNum +
                ", pm1ConcMass=" + pm1ConcMass +
                ", pm10ConcNum=" + pm10ConcNum +
                ", pm10ConcMass=" + pm10ConcMass +
                '}';
    }
}
