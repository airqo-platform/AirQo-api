resource "google_bigquery_table" "feeds_08_delete_me" {
  dataset_id = "thingspeak"
  project    = var.project-id
  schema     = "[{\"mode\":\"NULLABLE\",\"name\":\"created_at\",\"type\":\"DATETIME\"},{\"mode\":\"NULLABLE\",\"name\":\"channel_id\",\"type\":\"INTEGER\"},{\"mode\":\"NULLABLE\",\"name\":\"entry_id\",\"type\":\"INTEGER\"},{\"mode\":\"NULLABLE\",\"name\":\"pm2_5\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"pm10\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"s2_pm2_5\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"s2_pm10\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"latitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"longitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"voltage\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"altitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"wind\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"no_sats\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"hdope\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"temperature\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"humidity\",\"type\":\"FLOAT\"}]"
  table_id   = "feeds-08-delete-me"
}
# terraform import google_bigquery_table.feeds_08_delete_me projects/${var.project-id}/datasets/thingspeak/tables/feeds-08-delete-me
