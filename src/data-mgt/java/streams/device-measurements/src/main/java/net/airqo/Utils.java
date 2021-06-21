package net.airqo;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import net.airqo.models.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.lang.reflect.Type;
import java.util.*;

public class Utils {

    private static final Logger logger = LoggerFactory.getLogger(Utils.class);

    public static List<TransformedMeasurement> transformMeasurements(String rawMeasurements, String tenant) {

//        if(rawMeasurements.startsWith("\""))
//            rawMeasurements = rawMeasurements.replaceFirst("\"", "");
//
//        if(rawMeasurements.endsWith("\""))
//            rawMeasurements = rawMeasurements.substring(0, rawMeasurements.length() - 1);
//
//        rawMeasurements = rawMeasurements.replace("\\\"", "\"");

        switch (tenant.trim().toUpperCase()){
            case "KCCA":
                return transformKccaMeasurements(rawMeasurements);

            case "AIRQO":
                List<TransformedMeasurement> transformedMeasurements = transformAirQoMeasurements(rawMeasurements);
                return addAirQoCalibratedValues(transformedMeasurements);

            default:
                return new ArrayList<>();
        }
    }

    public static TransformedDeviceMeasurements generateTransformedOutput(List<TransformedMeasurement> transformedMeasurements) {

        List<Measurement> measurements = new ArrayList<>();

        transformedMeasurements.forEach(transformedMeasurement -> {

            Measurement measurement;
            try {
                measurement = Measurement.newBuilder()
                        .setDevice(transformedMeasurement.getDevice())
                        .setTenant(transformedMeasurement.getTenant())
                        .setFrequency(transformedMeasurement.getFrequency())
                        .setTime(transformedMeasurement.getTime())
                        .setChannelID(transformedMeasurement.getChannelID())
                        .setLocation(location.newBuilder()
                                .setLatitude(objectToDouble(transformedMeasurement.getLocation().get("latitude").get("value")))
                                .setLongitude(objectToDouble(transformedMeasurement.getLocation().get("longitude").get("value")))
                                .build())
                        .setPm1(pm1.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getPm1().get("value")))
                                .setCalibratedValue(objectToDouble(transformedMeasurement.getPm1().get("calibratedValue")))
                                .setStandardDeviationValue(objectToDouble(transformedMeasurement.getPm1().get("standardDeviationValue")))
                                .setUncertaintyValue(objectToDouble(transformedMeasurement.getPm1().get("uncertaintyValue")))
                                .build())
                        .setPm25(pm2_5.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getPm2_5().get("value")))
                                .setCalibratedValue(objectToDouble(transformedMeasurement.getPm2_5().get("calibratedValue")))
                                .setStandardDeviationValue(objectToDouble(transformedMeasurement.getPm2_5().get("standardDeviationValue")))
                                .setUncertaintyValue(objectToDouble(transformedMeasurement.getPm2_5().get("uncertaintyValue")))
                                .build())
                        .setS2Pm25(s2_pm2_5.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getS2_pm2_5().get("value")))
                                .setCalibratedValue(objectToDouble(transformedMeasurement.getS2_pm2_5().get("calibratedValue")))
                                .setStandardDeviationValue(objectToDouble(transformedMeasurement.getS2_pm2_5().get("standardDeviationValue")))
                                .setUncertaintyValue(objectToDouble(transformedMeasurement.getS2_pm2_5().get("uncertaintyValue")))
                                .build())
                        .setS2Pm10(s2_pm10.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getS2_pm10().get("value")))
                                .setCalibratedValue(objectToDouble(transformedMeasurement.getS2_pm10().get("calibratedValue")))
                                .setStandardDeviationValue(objectToDouble(transformedMeasurement.getS2_pm10().get("standardDeviationValue")))
                                .setUncertaintyValue(objectToDouble(transformedMeasurement.getS2_pm10().get("uncertaintyValue")))
                                .build())
                        .setPm10(pm10.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getPm10().get("value")))
                                .setCalibratedValue(objectToDouble(transformedMeasurement.getPm10().get("calibratedValue")))
                                .setStandardDeviationValue(objectToDouble(transformedMeasurement.getPm10().get("standardDeviationValue")))
                                .setUncertaintyValue(objectToDouble(transformedMeasurement.getPm10().get("uncertaintyValue")))
                                .build())
                        .setNo2(no2.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getNo2().get("value")))
                                .setCalibratedValue(objectToDouble(transformedMeasurement.getNo2().get("calibratedValue")))
                                .setStandardDeviationValue(objectToDouble(transformedMeasurement.getNo2().get("standardDeviationValue")))
                                .setUncertaintyValue(objectToDouble(transformedMeasurement.getNo2().get("uncertaintyValue")))
                                .build())
                        .setBattery(battery.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getBattery().get("value"))).build())
                        .setAltitude(altitude.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getAltitude().get("value"))).build())
                        .setSpeed(speed.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getSpeed().get("value"))).build())
                        .setSatellites(satellites.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getSatellites().get("value"))).build())
                        .setHdop(hdop.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getHdop().get("value"))).build())
                        .setInternalHumidity(internalHumidity.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getInternalHumidity().get("value")))
                                .build())
                        .setInternalTemperature(internalTemperature.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getInternalTemperature().get("value")))
                                .build())
                        .setExternalHumidity(externalHumidity.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getExternalHumidity().get("value")))
                                .build())
                        .setExternalTemperature(externalTemperature.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getExternalTemperature().get("value")))
                                .build())
                        .setExternalPressure(externalPressure.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getExternalPressure().get("value")))
                                .build())
                        .build();

                measurements.add(measurement);

            }
            catch (Exception e) {

//                e.printStackTrace();
            }

        });

        return TransformedDeviceMeasurements.newBuilder()
                .setMeasurements(measurements)
                .build();
    }

    public static List<TransformedMeasurement> transformKccaMeasurements(String rawMeasurements) {

        List<RawKccaMeasurement> deviceMeasurements;

        try {

            ObjectMapper objectMapper = new ObjectMapper();
            deviceMeasurements = objectMapper.readValue(rawMeasurements, new TypeReference<>() {});

        } catch (JsonProcessingException e) {
            e.printStackTrace();
            Type listType = new TypeToken<List<RawKccaMeasurement>>() {}.getType();
            deviceMeasurements = new Gson().fromJson(rawMeasurements, listType);
        }

        List<TransformedMeasurement> transformedMeasurements = new ArrayList<>();

        deviceMeasurements.forEach(rawMeasurement -> {

            TransformedMeasurement transformedMeasurement = new TransformedMeasurement();

            transformedMeasurement.setDevice(rawMeasurement.getDeviceCode());
            transformedMeasurement.setTenant("kcca");
            transformedMeasurement.setTime(rawMeasurement.getTime());
            transformedMeasurement.setFrequency(rawMeasurement.getAverage());

            ArrayList<Double> coordinates  = (ArrayList<Double>) rawMeasurement.getLocation().get("coordinates");
            transformedMeasurement.setLocation(new HashMap<>(){{
                put("longitude", new HashMap<>(){{
                    put("value", coordinates.get(0));
                }});
                put("latitude", new HashMap<>(){{
                    put("value", coordinates.get(1));
                }});
            }});

            for (String key: rawMeasurement.getCharacteristics().keySet()) {

                double rawValue = rawMeasurement.getCharacteristics().get(key).get("raw");
                double calibratedValue;

                if(rawMeasurement.getCharacteristics().get(key).containsKey("calibratedValue"))
                    calibratedValue = rawMeasurement.getCharacteristics().get(key).get("calibratedValue");
                else calibratedValue = rawMeasurement.getCharacteristics().get(key).getOrDefault("value", rawValue);

                HashMap<String, Object> values = new HashMap<>(){{
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
        logger.info("Records got : {}", transformedMeasurements.size());

        return transformedMeasurements;
    }

    public static List<TransformedMeasurement> transformAirQoMeasurements(String rawMeasurements) {


        List<RawAirQoMeasurement> deviceMeasurements;

        try {

            ObjectMapper objectMapper = new ObjectMapper();
            deviceMeasurements = objectMapper.readValue(rawMeasurements, new TypeReference<>() {});

        } catch (JsonProcessingException e) {
            e.printStackTrace();
            Type listType = new TypeToken<List<RawAirQoMeasurement>>() {}.getType();
            deviceMeasurements = new Gson().fromJson(rawMeasurements, listType);
        }

        List<TransformedMeasurement> transformedMeasurements = new ArrayList<>();

        deviceMeasurements.forEach(rawMeasurement -> {

            TransformedMeasurement transformedMeasurement = new TransformedMeasurement();

            transformedMeasurement.setDevice(rawMeasurement.getDevice());
            transformedMeasurement.setFrequency("raw");
            transformedMeasurement.setTenant("airqo");
            transformedMeasurement.setChannelID(rawMeasurement.getChannelId());
            transformedMeasurement.setTime(rawMeasurement.getTime());

            transformedMeasurement.setLocation(new HashMap<>(){{
                put("latitude", new HashMap<>(){{
                    put("value", Utils.stringToDouble(rawMeasurement.getLatitude()));
                }});
                put("longitude", new HashMap<>(){{
                    put("value", Utils.stringToDouble(rawMeasurement.getLongitude()));
                }});
            }});

            transformedMeasurement.setPm2_5(new HashMap<>() {{
                put("value", Utils.stringToDouble(rawMeasurement.getPm25()));
            }});

            transformedMeasurement.setPm10(new HashMap<>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getPm10()));
            }});

            transformedMeasurement.setS2_pm2_5(new HashMap<>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getS2Pm25()));
            }});

            transformedMeasurement.setS2_pm10(new HashMap<>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getS2Pm10()));
            }});

            transformedMeasurement.setAltitude(new HashMap<>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getAltitude()));
            }});

            transformedMeasurement.setSpeed(new HashMap<>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getSpeed()));
            }});

            transformedMeasurement.setBattery(new HashMap<>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getBattery()));
            }});

            transformedMeasurement.setSatellites(new HashMap<>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getSatellites()));
            }});

            transformedMeasurement.setHdop(new HashMap<>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getHdop()));
            }});

            transformedMeasurement.setExternalHumidity(new HashMap<>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getExternalHumidity()));
            }});

            transformedMeasurement.setExternalPressure(new HashMap<>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getExternalPressure()));
            }});

            transformedMeasurement.setExternalTemperature(new HashMap<>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getExternalTemperature()));
            }});

            transformedMeasurement.setInternalTemperature(new HashMap<>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getInternalTemperature()));
            }});

            transformedMeasurement.setInternalHumidity(new HashMap<>(){{
                put("value", Utils.stringToDouble(rawMeasurement.getInternalHumidity()));
            }});

            transformedMeasurements.add(transformedMeasurement);

        });

        logger.info(new Date( System.currentTimeMillis()).toString());
        logger.info("Records got : " + transformedMeasurements.size());

        return transformedMeasurements;
    }

    public static List<TransformedMeasurement> addAirQoCalibratedValues(List<TransformedMeasurement> measurements) {

        List<TransformedMeasurement> transformedMeasurements = new ArrayList<>();

        measurements.forEach(measurement -> {

            HashMap<String, Object>  pm25 = measurement.getPm2_5();

            try {
                Object calibratedValue = Calibrate.getCalibratedValue(measurement, null);
                pm25.put("calibratedValue", calibratedValue);

            } catch (IOException e) {
                logger.error("Calibration Error : {}", e.toString());
                pm25.put("calibratedValue", "null");
            }

            measurement.setPm2_5(pm25);

            transformedMeasurements.add(measurement);

        });

        return transformedMeasurements;
    }

    public static Properties loadPropertiesFile(String propertiesFile){

        if(propertiesFile == null)
            propertiesFile = "application.properties";

        Properties props = new Properties();

        try (InputStream input = Utils.class.getClassLoader().getResourceAsStream(propertiesFile)) {
            props.load(input);
        }
        catch (Exception ex){
            logger.error("Error loading properties file `{}` : {}", propertiesFile, ex.toString());
        }

        return props;
    }

    public static Object stringToDouble(String s){

        double aDouble;

        try {
            aDouble = Double.parseDouble(s);
            return aDouble;
        }
        catch (NumberFormatException ignored){
            return "null";
        }
    }


    public static int stringToInt(String s){

        int aInteger;

        try {
            aInteger = Integer.parseInt(s);
            return aInteger;
        }
        catch (NumberFormatException ignored){
            return -1;
        }
    }

    public static double objectToDouble(Object o){

        double aDouble;

        try {
            aDouble = Double.parseDouble(String.valueOf(o));
            return aDouble;
        }
        catch (NumberFormatException ignored){
            return 0.0;
        }
    }


}
