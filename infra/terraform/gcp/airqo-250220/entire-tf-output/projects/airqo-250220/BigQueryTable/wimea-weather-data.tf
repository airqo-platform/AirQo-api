resource "google_bigquery_table" "wimea_weather_data" {
  dataset_id = "thingspeak"
  project    = "airqo-250220"
  schema     = "[{\"mode\":\"NULLABLE\",\"name\":\"station_id\",\"type\":\"INTEGER\"},{\"mode\":\"NULLABLE\",\"name\":\"location\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"date\",\"type\":\"TIMESTAMP\"},{\"mode\":\"NULLABLE\",\"name\":\"reference_id\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"temp\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"rh\",\"type\":\"FLOAT\"}]"
  table_id   = "wimea_weather_data"
}
# terraform import google_bigquery_table.wimea_weather_data projects/airqo-250220/datasets/thingspeak/tables/wimea_weather_data
