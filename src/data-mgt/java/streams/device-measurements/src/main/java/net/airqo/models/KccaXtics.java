package net.airqo.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

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

    public KccaXticValue getRelHumid() {
        return relHumid;
    }

    public void setRelHumid(KccaXticValue relHumid) {
        this.relHumid = relHumid;
    }

    public KccaXticValue getTemperature() {
        return temperature;
    }

    public void setTemperature(KccaXticValue temperature) {
        this.temperature = temperature;
    }

    public KccaXticValue getNo2Conc() {
        return no2Conc;
    }

    public void setNo2Conc(KccaXticValue no2Conc) {
        this.no2Conc = no2Conc;
    }

    public KccaXticValue getPm2_5ConcNum() {
        return pm2_5ConcNum;
    }

    public void setPm2_5ConcNum(KccaXticValue pm2_5ConcNum) {
        this.pm2_5ConcNum = pm2_5ConcNum;
    }

    public KccaXticValue getPm2_5ConcMass() {
        return pm2_5ConcMass;
    }

    public void setPm2_5ConcMass(KccaXticValue pm2_5ConcMass) {
        this.pm2_5ConcMass = pm2_5ConcMass;
    }

    public KccaXticValue getPm1ConcNum() {
        return pm1ConcNum;
    }

    public void setPm1ConcNum(KccaXticValue pm1ConcNum) {
        this.pm1ConcNum = pm1ConcNum;
    }

    public KccaXticValue getPm1ConcMass() {
        return pm1ConcMass;
    }

    public void setPm1ConcMass(KccaXticValue pm1ConcMass) {
        this.pm1ConcMass = pm1ConcMass;
    }

    public KccaXticValue getPm10ConcNum() {
        return pm10ConcNum;
    }

    public void setPm10ConcNum(KccaXticValue pm10ConcNum) {
        this.pm10ConcNum = pm10ConcNum;
    }

    public KccaXticValue getPm10ConcMass() {
        return pm10ConcMass;
    }

    public void setPm10ConcMass(KccaXticValue pm10ConcMass) {
        this.pm10ConcMass = pm10ConcMass;
    }
}
