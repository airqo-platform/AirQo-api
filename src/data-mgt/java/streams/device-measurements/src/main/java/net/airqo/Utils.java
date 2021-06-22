package net.airqo;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import net.airqo.models.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Properties;

public class Utils {

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
                                .setLatitude(objectToDouble(transformedMeasurement.getLocation().getLatitude().getValue()))
                                .setLongitude(objectToDouble(transformedMeasurement.getLocation().getLongitude().getValue()))
                                .build())
                        .setPm1(pm1.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getPm1().getValue()))
                                .setCalibratedValue(objectToDouble(transformedMeasurement.getPm1().getCalibratedValue()))
                                .setStandardDeviationValue(objectToDouble(transformedMeasurement.getPm1().getStandardDeviationValue()))
                                .setUncertaintyValue(objectToDouble(transformedMeasurement.getPm1().getUncertaintyValue()))
                                .build())
                        .setPm25(pm2_5.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getPm2_5().getValue()))
                                .setCalibratedValue(objectToDouble(transformedMeasurement.getPm2_5().getCalibratedValue()))
                                .setStandardDeviationValue(objectToDouble(transformedMeasurement.getPm2_5().getStandardDeviationValue()))
                                .setUncertaintyValue(objectToDouble(transformedMeasurement.getPm2_5().getUncertaintyValue()))
                                .build())
                        .setS2Pm25(s2_pm2_5.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getS2_pm2_5().getValue()))
                                .setCalibratedValue(objectToDouble(transformedMeasurement.getS2_pm2_5().getCalibratedValue()))
                                .setStandardDeviationValue(objectToDouble(transformedMeasurement.getS2_pm2_5().getStandardDeviationValue()))
                                .setUncertaintyValue(objectToDouble(transformedMeasurement.getS2_pm2_5().getUncertaintyValue()))
                                .build())
                        .setS2Pm10(s2_pm10.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getS2_pm10().getValue()))
                                .setCalibratedValue(objectToDouble(transformedMeasurement.getS2_pm10().getCalibratedValue()))
                                .setStandardDeviationValue(objectToDouble(transformedMeasurement.getS2_pm10().getStandardDeviationValue()))
                                .setUncertaintyValue(objectToDouble(transformedMeasurement.getS2_pm10().getUncertaintyValue()))
                                .build())
                        .setPm10(pm10.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getPm10().getValue()))
                                .setCalibratedValue(objectToDouble(transformedMeasurement.getPm10().getCalibratedValue()))
                                .setStandardDeviationValue(objectToDouble(transformedMeasurement.getPm10().getStandardDeviationValue()))
                                .setUncertaintyValue(objectToDouble(transformedMeasurement.getPm10().getUncertaintyValue()))
                                .build())
                        .setNo2(no2.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getNo2().getValue()))
                                .setCalibratedValue(objectToDouble(transformedMeasurement.getNo2().getCalibratedValue()))
                                .setStandardDeviationValue(objectToDouble(transformedMeasurement.getNo2().getStandardDeviationValue()))
                                .setUncertaintyValue(objectToDouble(transformedMeasurement.getNo2().getUncertaintyValue()))
                                .build())
                        .setBattery(battery.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getBattery().getValue())).build())
                        .setAltitude(altitude.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getAltitude().getValue())).build())
                        .setSpeed(speed.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getSpeed().getValue())).build())
                        .setSatellites(satellites.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getSatellites().getValue())).build())
                        .setHdop(hdop.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getHdop().getValue())).build())
                        .setInternalHumidity(internalHumidity.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getInternalHumidity().getValue()))
                                .build())
                        .setInternalTemperature(internalTemperature.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getInternalTemperature().getValue()))
                                .build())
                        .setExternalHumidity(externalHumidity.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getExternalHumidity().getValue()))
                                .build())
                        .setExternalTemperature(externalTemperature.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getExternalTemperature().getValue()))
                                .build())
                        .setExternalPressure(externalPressure.newBuilder()
                                .setValue(objectToDouble(transformedMeasurement.getExternalPressure().getValue()))
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
            objectMapper.enable(DeserializationFeature.ACCEPT_EMPTY_STRING_AS_NULL_OBJECT);
            deviceMeasurements = objectMapper.readValue(rawMeasurements, new TypeReference<>() {});


        } catch (JsonProcessingException e)
        {
            e.printStackTrace();
            return new ArrayList<>();
        }

        List<TransformedMeasurement> transformedMeasurements = new ArrayList<>();

        deviceMeasurements.forEach(rawMeasurement -> {

            TransformedMeasurement transformedMeasurement = new TransformedMeasurement();

            transformedMeasurement.setDevice(rawMeasurement.getDeviceCode());
            transformedMeasurement.setTenant("kcca");
            transformedMeasurement.setTime(rawMeasurement.getTime());
            transformedMeasurement.setFrequency(rawMeasurement.getAverage());

            List<Double> coordinates  =  rawMeasurement.getLocation().getCoordinates();
            transformedMeasurement.setLocation(new TransformedLocation(){{
                setLatitude(new LocationValue(coordinates.get(0)));
                setLatitude(new LocationValue(coordinates.get(1)));
            }});

            transformedMeasurement.setPm10(new TransformedValue(){{
                setValue(rawMeasurement.getCharacteristics().getPm10ConcMass().getRaw());
                setCalibratedValue(rawMeasurement.getCharacteristics().getPm10ConcMass().getCalibratedValue());
            }});

            transformedMeasurement.setInternalHumidity(new TransformedValue(){{
                setValue(rawMeasurement.getCharacteristics().getRelHumid().getRaw());
                setCalibratedValue(rawMeasurement.getCharacteristics().getRelHumid().getCalibratedValue());
            }});

            transformedMeasurement.setInternalTemperature(new TransformedValue(){{
                setValue(rawMeasurement.getCharacteristics().getTemperature().getRaw());
                setCalibratedValue(rawMeasurement.getCharacteristics().getTemperature().getCalibratedValue());
            }});

            transformedMeasurement.setPm2_5(new TransformedValue(){{
                setValue(rawMeasurement.getCharacteristics().getPm2_5ConcMass().getRaw());
                setCalibratedValue(rawMeasurement.getCharacteristics().getPm2_5ConcMass().getCalibratedValue());
            }});

            transformedMeasurement.setNo2(new TransformedValue(){{
                setValue(rawMeasurement.getCharacteristics().getNo2Conc().getRaw());
                setCalibratedValue(rawMeasurement.getCharacteristics().getNo2Conc().getCalibratedValue());
            }});

            transformedMeasurement.setPm1(new TransformedValue(){{
                setValue(rawMeasurement.getCharacteristics().getPm1ConcMass().getRaw());
                setCalibratedValue(rawMeasurement.getCharacteristics().getPm1ConcMass().getCalibratedValue());
            }});

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
            objectMapper.enable(DeserializationFeature.ACCEPT_EMPTY_STRING_AS_NULL_OBJECT);
            deviceMeasurements = objectMapper.readValue(rawMeasurements, new TypeReference<>() {});

        } catch (JsonProcessingException e) {
            e.printStackTrace();
            return new ArrayList<>();
        }

        List<TransformedMeasurement> transformedMeasurements = new ArrayList<>();

        deviceMeasurements.forEach(rawMeasurement -> {

            TransformedMeasurement transformedMeasurement = new TransformedMeasurement();

            transformedMeasurement.setDevice(rawMeasurement.getDevice());
            transformedMeasurement.setFrequency(rawMeasurement.getFrequency());
            transformedMeasurement.setTenant("airqo");
            transformedMeasurement.setChannelID(rawMeasurement.getChannelId());
            transformedMeasurement.setTime(rawMeasurement.getTime());

            transformedMeasurement.setLocation(new TransformedLocation(){{
                setLatitude(new LocationValue(Utils.stringToDouble(rawMeasurement.getLatitude())));
                setLongitude(new LocationValue(Utils.stringToDouble(rawMeasurement.getLongitude())));
            }});

            transformedMeasurement.setPm2_5(new TransformedValue(){{
                setValue(Utils.stringToDouble(rawMeasurement.getPm25()));
            }});

            transformedMeasurement.setPm10(new TransformedValue(){{
                setValue(Utils.stringToDouble(rawMeasurement.getPm10()));
            }});

            transformedMeasurement.setS2_pm2_5(new TransformedValue(){{
                setValue(Utils.stringToDouble(rawMeasurement.getS2Pm25()));
            }});

            transformedMeasurement.setS2_pm10(new TransformedValue(){{
                setValue(Utils.stringToDouble(rawMeasurement.getS2Pm10()));
            }});

            transformedMeasurement.setAltitude(new TransformedValue(){{
                setValue(Utils.stringToDouble(rawMeasurement.getAltitude()));
            }});

            transformedMeasurement.setSpeed(new TransformedValue(){{
                setValue(Utils.stringToDouble(rawMeasurement.getSpeed()));
            }});

            transformedMeasurement.setBattery(new TransformedValue(){{
                setValue(Utils.stringToDouble(rawMeasurement.getBattery()));
            }});

            transformedMeasurement.setSatellites(new TransformedValue(){{
                setValue(Utils.stringToDouble(rawMeasurement.getSatellites()));
            }});

            transformedMeasurement.setHdop(new TransformedValue(){{
                setValue(Utils.stringToDouble(rawMeasurement.getHdop()));
            }});

            transformedMeasurement.setExternalHumidity(new TransformedValue(){{
                setValue(Utils.stringToDouble(rawMeasurement.getExternalHumidity()));
            }});

            transformedMeasurement.setExternalPressure(new TransformedValue(){{
                setValue(Utils.stringToDouble(rawMeasurement.getExternalPressure()));
            }});

            transformedMeasurement.setExternalTemperature(new TransformedValue(){{
                setValue(Utils.stringToDouble(rawMeasurement.getExternalTemperature()));
            }});

            transformedMeasurement.setInternalTemperature(new TransformedValue(){{
                setValue(Utils.stringToDouble(rawMeasurement.getInternalTemperature()));
            }});

            transformedMeasurement.setInternalHumidity(new TransformedValue(){{
                setValue(Utils.stringToDouble(rawMeasurement.getInternalHumidity()));
            }});

            transformedMeasurements.add(transformedMeasurement);

        });

        logger.info(new Date( System.currentTimeMillis()).toString());
        logger.info("Records got : " + transformedMeasurements.size());

        return transformedMeasurements;
    }

    public static List<TransformedMeasurement> addAirQoCalibratedValues(List<TransformedMeasurement> measurements) {

        List<TransformedMeasurement> transformedMeasurements = new ArrayList<>();

        String propertiesUrlFile = "application.properties";
        Properties props = Utils.loadPropertiesFile(propertiesUrlFile);
        String urlString = props.getProperty("calibrate.url", null);

        measurements.forEach(measurement -> {

            TransformedValue  pm25 = measurement.getPm2_5();

            try {
                Double calibratedValue = Calibrate.getCalibratedValue(measurement, urlString);
                pm25.setCalibratedValue(calibratedValue);

            } catch (IOException e) {
                logger.error("Calibration Error : {}", e.toString());
                pm25.setCalibratedValue(null);
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

    public static Double stringToDouble(String s){

        double aDouble;

        try {
            aDouble = Double.parseDouble(s);
            return aDouble;
        }
        catch (NumberFormatException ignored){
            return null;
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
