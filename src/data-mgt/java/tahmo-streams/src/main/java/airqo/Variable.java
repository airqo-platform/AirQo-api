package airqo;

public enum Variable {
    TEMPERATURE{
        @Override
        public String toString() {
            return "te";
        }
    },
    HUMIDITY{
        @Override
        public String toString() {
            return "rh";
        }
    };

    public static Variable fromString(String str){
        if(str.trim().equalsIgnoreCase("rh"))
            return Variable.HUMIDITY;
        else if (str.trim().equalsIgnoreCase("te"))
            return Variable.TEMPERATURE;
        else
            return null;
    }

    public String toString() {
        return "$classname{}";
    }
}
