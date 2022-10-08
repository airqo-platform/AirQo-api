resource "google_bigquery_table" "last_entry" {
  dataset_id = "thingspeak"
  project    = "${var.project-id}"
  schema     = "[{\"mode\":\"NULLABLE\",\"name\":\"channel_id\",\"type\":\"INTEGER\"},{\"mode\":\"NULLABLE\",\"name\":\"created_at\",\"type\":\"DATETIME\"},{\"mode\":\"NULLABLE\",\"name\":\"latitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"longitude\",\"type\":\"FLOAT\"}]"
  table_id   = "last_entry"
}
# terraform import google_bigquery_table.last_entry projects/airqo-250220/datasets/thingspeak/tables/last_entry
