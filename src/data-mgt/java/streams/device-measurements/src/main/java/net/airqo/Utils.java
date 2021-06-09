package net.airqo;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import net.airqo.models.RawAirQoMeasurement;
import net.airqo.models.RawKccaMeasurement;
import net.airqo.models.TransformedMeasurement;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Type;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.*;
import java.util.function.UnaryOperator;

public class Utils {

    private static class CalibratedBody {
        String datetime;
        HashMap<String, Object> raw_values;

        public String getDatetime() {
            return datetime;
        }

        public void setDatetime(String datetime) {
            this.datetime = datetime;
        }

        public HashMap<String, Object> getRaw_values() {
            return raw_values;
        }

        public void setRaw_values(HashMap<String, Object> raw_values) {
            this.raw_values = raw_values;
        }
    }

    private static final Logger logger = LoggerFactory.getLogger(Utils.class);

    public static List<TransformedMeasurement> transformMeasurements(String rawMeasurements, String tenant) {

        if(rawMeasurements.startsWith("\""))
            rawMeasurements = rawMeasurements.replaceFirst("\"", "");

        if(rawMeasurements.endsWith("\""))
            rawMeasurements = rawMeasurements.substring(0, rawMeasurements.length() - 1);

        rawMeasurements = rawMeasurements.replace("\\\"", "\"");

        switch (tenant.trim().toUpperCase()){
            case "KCCA":
                return transformKccaMeasurements(rawMeasurements);
            case "AIRQO":
                return transformAirQoMeasurements(rawMeasurements);
            default:
                return new ArrayList<>();
        }
    }

    public static List<TransformedMeasurement> transformKccaMeasurements(String rawMeasurements) {

        Type listType = new TypeToken<List<RawKccaMeasurement>>() {}.getType();
        List<RawKccaMeasurement> deviceMeasurements = new Gson().fromJson(rawMeasurements, listType);

        List<TransformedMeasurement> transformedMeasurements = new ArrayList<>();

        deviceMeasurements.forEach(rawMeasurement -> {

            TransformedMeasurement transformedMeasurement = new TransformedMeasurement();

            transformedMeasurement.setDevice(rawMeasurement.getDeviceCode());
            transformedMeasurement.setFrequency("hourly");
            transformedMeasurement.setTenant("kcca");
            transformedMeasurement.setTime(rawMeasurement.getTime());

            ArrayList<Double> coordinates  = (ArrayList<Double>) rawMeasurement.getLocation().get("coordinates");
            transformedMeasurement.setLocation(new HashMap<String, HashMap<String, Object>>(){{
                put("latitude", new HashMap<String, Object>(){{
                    put("value", coordinates.get(0));
                }});
                put("longitude", new HashMap<String, Object>(){{
                    put("value", coordinates.get(1));
                }});
            }});

            for (String key: rawMeasurement.getCharacteristics().keySet()) {

                double rawValue = rawMeasurement.getCharacteristics().get(key).get("raw");
                double calibratedValue;

                if(rawMeasurement.getCharacteristics().get(key).containsKey("calibratedValue"))
                    calibratedValue = rawMeasurement.getCharacteristics().get(key).get("calibratedValue");
                else calibratedValue = rawMeasurement.getCharacteristics().get(key).getOrDefault("value", rawValue);

                HashMap<String, Object> values = new HashMap<String, Object>(){{
                    put("value", rawValue);
                    put("calibratedValue", calibratedValue);

                }};

                key = key.trim().toLowerCase();

                switch (key){
                    case "temperature":
                        transformedMeasurement.setInternalTemperature(values);
                        break;

                    case "relhumid":
                        transformedMeasurement.setInternalHumidity(values);
                        break;

                    case "pm10concmass":
                        transformedMeasurement.setPm10(values);
                        break;

                    case "pm2_5concmass":
                        transformedMeasurement.setPm2_5(values);
                        break;

                    case "no2conc":
                        transformedMeasurement.setNo2(values);
                        break;

                    case "pm1concmass":
                        transformedMeasurement.setPm1(values);
                        break;

                    default:
                        break;

                }
            }

            transformedMeasurements.add(transformedMeasurement);

        });

        logger.info(new Date( System.currentTimeMillis()).toString());
        logger.info("Records got : " + String.valueOf(transformedMeasurements.size()));

        return transformedMeasurements;
    }

    public static List<TransformedMeasurement> transformAirQoMeasurements(String rawMeasurements) {

        Type listType = new TypeToken<List<RawAirQoMeasurement>>() {}.getType();
        List<RawAirQoMeasurement> deviceMeasurements = new Gson().fromJson(rawMeasurements, listType);

        List<TransformedMeasurement> transformedMeasurements = new ArrayList<>();

        deviceMeasurements.forEach(rawMeasurement -> {

            TransformedMeasurement transformedMeasurement = new TransformedMeasurement();

            transformedMeasurement.setDevice(rawMeasurement.getDevice());
            transformedMeasurement.setFrequency("raw");
            transformedMeasurement.setTenant("airqo");
            transformedMeasurement.setChannelID(Integer.parseInt(rawMeasurement.getChannelId()));
            transformedMeasurement.setTime(rawMeasurement.getTime());

            transformedMeasurement.setLocation(new HashMap<String, HashMap<String, Object>>(){{
                put("latitude", new HashMap<String, Object>(){{
                    put("value", Utils.stringToDouble(rawMeasurement.getLatitude()));
                }});
                put("longitude", new HashMap<String, Object>(){{
                    put("value", Utils.stringToDouble(rawMeasurement.getLongitude()));
                }});
            }});

            transformedMeasurement.setInternalTemperature(new HashMap<String, Object>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getInternalTemperature()));
                put("calibratedValue", Utils.stringToDouble(rawMeasurement.getInternalTemperature()));
            }});

            transformedMeasurement.setInternalHumidity(new HashMap<String, Object>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getInternalHumidity()));
                put("calibratedValue", Utils.stringToDouble(rawMeasurement.getInternalHumidity()));
            }});

            transformedMeasurement.setPm2_5(new HashMap<String, Object>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getPm25()));
                put("calibratedValue", Utils.stringToDouble(rawMeasurement.getPm25()));

            }});

            transformedMeasurement.setPm10(new HashMap<String, Object>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getPm10()));
                put("calibratedValue", Utils.stringToDouble(rawMeasurement.getPm10()));

            }});

            transformedMeasurement.setS2_pm2_5(new HashMap<String, Object>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getS2Pm25()));
                put("calibratedValue", Utils.stringToDouble(rawMeasurement.getS2Pm25()));

            }});

            transformedMeasurement.setS2_pm10(new HashMap<String, Object>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getS2Pm10()));
                put("calibratedValue", Utils.stringToDouble(rawMeasurement.getS2Pm10()));

            }});

            transformedMeasurement.setAltitude(new HashMap<String, Object>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getAltitude()));
                put("calibratedValue", Utils.stringToDouble(rawMeasurement.getAltitude()));

            }});

            transformedMeasurement.setSpeed(new HashMap<String, Object>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getSpeed()));
                put("calibratedValue", Utils.stringToDouble(rawMeasurement.getSpeed()));

            }});

            transformedMeasurement.setBattery(new HashMap<String, Object>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getBattery()));
                put("calibratedValue", Utils.stringToDouble(rawMeasurement.getBattery()));

            }});

            transformedMeasurement.setSatellites(new HashMap<String, Object>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getSatellites()));
                put("calibratedValue", Utils.stringToDouble(rawMeasurement.getSatellites()));

            }});

            transformedMeasurement.setHdop(new HashMap<String, Object>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getHdop()));
                put("calibratedValue", Utils.stringToDouble(rawMeasurement.getHdop()));

            }});


            transformedMeasurements.add(transformedMeasurement);

        });

        logger.info(new Date( System.currentTimeMillis()).toString());
        logger.info("Records got : " + transformedMeasurements.size());

        return transformedMeasurements;
    }

    public static CalibratedBody getCalibratedValue(TransformedMeasurement transformedMeasurement) throws IOException {

        CalibratedBody body = new CalibratedBody(){{
            setDatetime(transformedMeasurement.getTime());
            setRaw_values(new HashMap<String, Object>(){{
                put("device_id", transformedMeasurement.getDevice());
                put("pm2.5", transformedMeasurement.getPm2_5());
                put("pm10", transformedMeasurement.getPm10());
                put("temperature", transformedMeasurement.getInternalTemperature());
                put("humidity", transformedMeasurement.getInternalHumidity());
            }});
        }};

        Properties props = loadPropertiesFile(null);

        if(!props.containsKey("calibrate.url"))
            throw new IOException("calibrate.url is missing in application.properties file");

        String urlString = props.getProperty("calibrate.url");

        URL url = new URL(urlString);

        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Accept", "application/json");

        conn.connect();

        int responseCode = conn.getResponseCode();

        if(responseCode == 200){

            logger.info("connection successful");

        }

        conn.disconnect();

        return body;
    }

    public static Properties loadPropertiesFile(String propertiesFile){

        if(propertiesFile == null)
            propertiesFile = "application.properties";

        Properties props = new Properties();

        try (InputStream input = Utils.class.getClassLoader().getResourceAsStream(propertiesFile)) {
            props.load(input);
        }
        catch (IOException ex){
            System.err.println(ex.getMessage());
        }

        return props;
    }


//    public static List<T> stringToObjectList(String s, T t){
//
//        Type listType = new TypeToken<List<t>>() {}.getType();
//
//        return new Gson().fromJson(s, listType);
//
//    }

    public static Object stringToDouble(String s){

        double aDouble = 0.0;

        try {
            aDouble = Double.parseDouble(s);
        }
        catch (NumberFormatException ignored){
            return "null";
        }

        return aDouble;
    }
}
