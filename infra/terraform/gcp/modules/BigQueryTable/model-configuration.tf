resource "google_bigquery_table" "model_configuration" {
  dataset_id  = "thingspeak"
  description = "table contains best  configurations obtained after training model"
  project     = var.project-id
  schema      = "[{\"mode\":\"REQUIRED\",\"name\":\"model_name\",\"type\":\"STRING\"},{\"mode\":\"REQUIRED\",\"name\":\"channel_id\",\"type\":\"INTEGER\"},{\"mode\":\"REQUIRED\",\"name\":\"number_of_days_to_use\",\"type\":\"INTEGER\"},{\"mode\":\"REQUIRED\",\"name\":\"recorded_rmse\",\"type\":\"FLOAT\"},{\"mode\":\"REQUIRED\",\"name\":\"created_at\",\"type\":\"DATETIME\"},{\"name\":\"considered_hours\",\"type\":\"INTEGER\"}]"
  table_id    = "model_configuration"
}
# terraform import google_bigquery_table.model_configuration projects/${var.project-id}/datasets/thingspeak/tables/model_configuration
