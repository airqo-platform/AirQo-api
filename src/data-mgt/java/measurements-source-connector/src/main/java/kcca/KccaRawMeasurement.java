package kcca;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;
import org.apache.kafka.connect.data.Schema;
import org.apache.kafka.connect.data.SchemaBuilder;

import java.io.Serializable;
import java.util.HashMap;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class KccaRawMeasurement implements Serializable {

    private String _id;
    private String recId;
    private String time;
    private String device;
    private String deviceCode;
    private String average = "raw";
    private HashMap<String, Object> location;
    private HashMap<String, HashMap<String, Double>> characteristics;

    @Override
    public String toString() {
        return "RawMeasurements{" +
                "_id='" + _id + '\'' +
                ", recId='" + recId + '\'' +
                ", time='" + time + '\'' +
                ", device='" + device + '\'' +
                ", deviceCode='" + deviceCode + '\'' +
                ", average='" + average + '\'' +
                ", location=" + location +
                ", characteristics=" + characteristics +
                '}';
    }
}
