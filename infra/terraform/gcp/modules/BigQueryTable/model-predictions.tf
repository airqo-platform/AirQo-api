resource "google_bigquery_table" "model_predictions" {
  dataset_id = "thingspeak"
  project    = var.project-id
  schema     = "[{\"mode\":\"NULLABLE\",\"name\":\"model_name\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"channel_id\",\"type\":\"INTEGER\"},{\"mode\":\"NULLABLE\",\"name\":\"location_name\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"location_latitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"location_longitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"prediction_value\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"prediction_start_datetime\",\"type\":\"DATETIME\"},{\"mode\":\"NULLABLE\",\"name\":\"prediction_datetime\",\"type\":\"DATETIME\"},{\"mode\":\"NULLABLE\",\"name\":\"lower_confidence_interval_value\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"upper_confidence_interval_value\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"created_at\",\"type\":\"DATETIME\"}]"
  table_id   = "model_predictions"
}
# terraform import google_bigquery_table.model_predictions projects/${var.project-id}/datasets/thingspeak/tables/model_predictions
