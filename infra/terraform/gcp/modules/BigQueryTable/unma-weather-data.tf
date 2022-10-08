resource "google_bigquery_table" "unma_weather_data" {
  dataset_id = "thingspeak"
  project    = var.project-id
  schema     = "[{\"mode\":\"NULLABLE\",\"name\":\"location\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"date\",\"type\":\"DATE\"},{\"mode\":\"NULLABLE\",\"name\":\"rainfall\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"tmax\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"tmin\",\"type\":\"FLOAT\"}]"
  table_id   = "unma_weather_data"
}
# terraform import google_bigquery_table.unma_weather_data projects/${var.project-id}/datasets/thingspeak/tables/unma_weather_data
