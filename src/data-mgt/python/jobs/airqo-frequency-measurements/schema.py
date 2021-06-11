value_schema_str = """
{
    "namespace": "net.airqo.models",
    "type": "record",
    "name": "TransformedDeviceMeasurements",
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
                            "name": "frequency", "type": "string"
                        },
                        {
                            "name": "time", "type": "string"
                        },
                        {
                            "name": "device", "type": "string"
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
                                    {"name": "latitude", "type": ["double", "null"]}, 
                                    {"name": "longitude", "type": ["double", "null"]}
                                ]
                        }
                        },
                        {
                            "name": "internalTemperature",
                            "type": {
                                "type": "record", 
                                "name": "internalTemperature",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"] },
                                    {"name": "calibratedValue", "type": ["null", "double"]}
                                ]
                            }
                        },
                        {
                            "name": "internalHumidity",
                            "type": {
                                "type": "record", 
                                "name": "internalHumidity",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"] },
                                    {"name": "calibratedValue", "type": ["null", "double"]}
                                ]
                            }
                        },
                        {
                            "name": "externalTemperature",
                            "type": {
                                "type": "record", 
                                "name": "externalTemperature",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"] },
                                    {"name": "calibratedValue", "type": ["null", "double"]}
                                ]
                            }
                        },
                        {
                            "name": "externalHumidity",
                            "type": {
                                "type": "record", 
                                "name": "externalHumidity",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"] },
                                    {"name": "calibratedValue", "type": ["null", "double"]}
                                ]
                            }
                        },
                        {
                            "name": "pm10",
                            "type": {
                                "type": "record", 
                                "name": "pm10",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"] },
                                    {"name": "calibratedValue", "type": ["null", "double"]}
                                ]
                            }
                        },
                        {
                            "name": "pm2_5",
                            "type": {
                                "type": "record", 
                                "name": "pm2_5",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"] },
                                    {"name": "calibratedValue", "type": ["null", "double"]}
                                ]
                            }
                        },
                        {
                            "name": "no2",
                            "type": {
                                "type": "record", 
                                "name": "no2",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"] },
                                    {"name": "calibratedValue", "type": ["null", "double"]}
                                ]
                            }
                        },
                        {
                            "name": "pm1",
                            "type": {
                                "type": "record", 
                                "name": "pm1",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"] },
                                    {"name": "calibratedValue", "type": ["null", "double"]}
                                ]
                            }
                        },
                        {
                            "name": "speed",
                            "type": {
                                "type": "record", 
                                "name": "speed",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"] },
                                    {"name": "calibratedValue", "type": ["null", "double"]}
                                ]
                            }
                        },
                        {
                            "name": "altitude",
                            "type": {
                                "type": "record", 
                                "name": "altitude",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"] },
                                    {"name": "calibratedValue", "type": ["null", "double"]}
                                ]
                            }
                        },
                        {
                            "name": "battery",
                            "type": {
                                "type": "record", 
                                "name": "battery",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"] },
                                    {"name": "calibratedValue", "type": ["null", "double"]}
                                ]
                            }
                        },
                        {
                            "name": "satellites",
                            "type": {
                                "type": "record", 
                                "name": "satellites",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"] },
                                    {"name": "calibratedValue", "type": ["null", "double"]}
                                ]
                            }
                        },
                        {
                            "name": "hdop",
                            "type": {
                                "type": "record", 
                                "name": "hdop",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"] },
                                    {"name": "calibratedValue", "type": ["null", "double"]}
                                ]
                            }
                        },
                        {
                            "name": "s2_pm10",
                            "type": {
                                "type": "record", 
                                "name": "s2_pm10",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"] },
                                    {"name": "calibratedValue", "type": ["null", "double"]}
                                ]
                            }
                        },
                        {
                            "name": "s2_pm2_5",
                            "type": {
                                "type": "record", 
                                "name": "s2_pm2_5",
                                "fields": [
                                    {"name": "value", "type": ["null", "double"] },
                                    {"name": "calibratedValue", "type": ["null", "double"]}
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