schema_str = """
{
    "namespace": "confluent.io.examples.serialization.avro",
    "name": "User",
    "type": "record",
    "fields": [
        {"name": "name", "type": "string"},
        {"name": "favorite_number", "type": "int"},
        {"name": "favorite_color", "type": "string"}
    ]
}
"""