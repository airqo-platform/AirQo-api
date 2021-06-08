package net.airqo;

public class Utils {

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
