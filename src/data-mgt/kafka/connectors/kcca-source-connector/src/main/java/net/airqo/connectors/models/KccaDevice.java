package net.airqo.connectors.models;

import java.io.Serializable;

public class KccaDevice implements Serializable {

    String _id;
    String code;


    public String get_id() {
        return _id;
    }

    public void set_id(String _id) {
        this._id = _id;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }
}
