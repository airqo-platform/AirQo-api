schema_str = """
{
    "namespace": "net.airqo.models",
    "type": "record",
    "name": "TransformedDeviceMeasurements",
    "aliases": ["TransformedDeviceMeasurementsValue"],
    "doc": "https://github.com/airqo-platform/AirQo-api/blob/staging/src/device-registry/models/Event.js",
    "fields": [

        {
            "name":"measurements",
            "type":{
                "type": "array",  
                "items":{
                    "name":"Measurement",
                    "type":"record",
                    "fields":[
                        {
                            "name": "frequency", "type": "string", "default" : "raw"
                        },
                        {
                            "name": "time", "type": "string"
                        },
                        {
                            "name": "device", "type": "string"
                        },
                        {
                            "name": "site_id", "type": "string"
                        },
                        {
                            "name": "channelID", "type": ["null", "int"], "default": null
                        },
                        {
                            "name": "tenant", "type": "string"
                        },
                        {
                            "name": "location",
                            "type": {
                                "type": "record", 
                                "name": "location",
                                "fields": [
                                    {"name": "latitude", "type": ["null", "double"], "default": null}, 
                                    {"name": "longitude", "type": ["null", "double"], "default": null}
                                ]
                        }
                        },
                        {
                            "name": "internalTemperature",
                            "type": {
                                "type": "record", 
                                "name": "internalTemperature",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"], "default": null }
                                ]
                            }
                        },
                        {
                            "name": "internalHumidity",
                            "type": {
                                "type": "record", 
                                "name": "internalHumidity",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"], "default": null }
                                ]
                            }
                        },
                        {
                            "name": "externalTemperature",
                            "type": {
                                "type": "record", 
                                "name": "externalTemperature",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"], "default": null }
                                ]
                            }
                        },
                        {
                            "name": "externalHumidity",
                            "type": {
                                "type": "record", 
                                "name": "externalHumidity",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"], "default": null }
                                ]
                            }
                        },
                        {
                            "name": "externalPressure",
                            "type": {
                                "type": "record", 
                                "name": "externalPressure",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"], "default": null }
                                ]
                            }
                        },
                        {
                            "name": "pm10",
                            "type": {
                                "type": "record", 
                                "name": "pm10",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"], "default": null },
                                    {"name": "calibratedValue", "type": ["null", "double"], "default": null},
                                    {"name": "uncertaintyValue", "type": ["null", "double"], "default": null },
                                    {"name": "standardDeviationValue", "type": ["null", "double"], "default": null}
                                ]
                            }
                        },
                        {
                            "name": "pm2_5",
                            "type": {
                                "type": "record", 
                                "name": "pm2_5",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"], "default": null },
                                    {"name": "calibratedValue", "type": ["null", "double"], "default": null},
                                    {"name": "uncertaintyValue", "type": ["null", "double"], "default": null },
                                    {"name": "standardDeviationValue", "type": ["null", "double"], "default": null}
                                ]
                            }
                        },
                        {
                            "name": "no2",
                            "type": {
                                "type": "record", 
                                "name": "no2",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"], "default": null },
                                    {"name": "calibratedValue", "type": ["null", "double"], "default": null},
                                    {"name": "uncertaintyValue", "type": ["null", "double"], "default": null },
                                    {"name": "standardDeviationValue", "type": ["null", "double"], "default": null}
                                ]
                            }
                        },
                        {
                            "name": "pm1",
                            "type": {
                                "type": "record", 
                                "name": "pm1",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"], "default": null },
                                    {"name": "calibratedValue", "type": ["null", "double"], "default": null},
                                    {"name": "uncertaintyValue", "type": ["null", "double"], "default": null },
                                    {"name": "standardDeviationValue", "type": ["null", "double"], "default": null}
                                ]
                            }
                        },
                        {
                            "name": "speed",
                            "type": {
                                "type": "record", 
                                "name": "speed",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"], "default": null }
                                ]
                            }
                        },
                        {
                            "name": "altitude",
                            "type": {
                                "type": "record", 
                                "name": "altitude",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"], "default": null }
                                ]
                            }
                        },
                        {
                            "name": "battery",
                            "type": {
                                "type": "record", 
                                "name": "battery",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"], "default": null }
                                ]
                            }
                        },
                        {
                            "name": "satellites",
                            "type": {
                                "type": "record", 
                                "name": "satellites",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"], "default": null }
                                ]
                            }
                        },
                        {
                            "name": "hdop",
                            "type": {
                                "type": "record", 
                                "name": "hdop",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"], "default": null }
                                ]
                            }
                        },
                        {
                            "name": "s2_pm10",
                            "type": {
                                "type": "record", 
                                "name": "s2_pm10",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"], "default": null },
                                    {"name": "calibratedValue", "type": ["null", "double"], "default": null},
                                    {"name": "uncertaintyValue", "type": ["null", "double"], "default": null },
                                    {"name": "standardDeviationValue", "type": ["null", "double"], "default": null}
                                ]
                            }
                        },
                        {
                            "name": "s2_pm2_5",
                            "type": {
                                "type": "record", 
                                "name": "s2_pm2_5",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"], "default": null },
                                    {"name": "calibratedValue", "type": ["null", "double"], "default": null},
                                    {"name": "uncertaintyValue", "type": ["null", "double"], "default": null },
                                    {"name": "standardDeviationValue", "type": ["null", "double"], "default": null}
                                ]
                            }
                        }
                    ]
                }
            }
        }

    ]
}
"""