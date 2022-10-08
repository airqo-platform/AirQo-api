resource "google_bigquery_table" "clean_feeds_pms" {
  dataset_id = "thingspeak"
  project    = var.project-id
  schema     = "[{\"name\":\"created_at\",\"type\":\"DATETIME\"},{\"name\":\"channel_id\",\"type\":\"INTEGER\"},{\"name\":\"entry_id\",\"type\":\"INTEGER\"},{\"name\":\"pm2_5\",\"type\":\"FLOAT\"},{\"name\":\"pm10\",\"type\":\"FLOAT\"},{\"name\":\"s2_pm2_5\",\"type\":\"FLOAT\"},{\"name\":\"s2_pm10\",\"type\":\"FLOAT\"},{\"name\":\"latitude\",\"type\":\"FLOAT\"},{\"name\":\"longitude\",\"type\":\"FLOAT\"},{\"name\":\"voltage\",\"type\":\"FLOAT\"},{\"name\":\"altitude\",\"type\":\"FLOAT\"},{\"name\":\"wind\",\"type\":\"FLOAT\"},{\"name\":\"no_sats\",\"type\":\"FLOAT\"},{\"name\":\"hdope\",\"type\":\"FLOAT\"},{\"name\":\"temperature\",\"type\":\"FLOAT\"},{\"name\":\"humidity\",\"type\":\"FLOAT\"}]"
  table_id   = "clean_feeds_pms"
}
# terraform import google_bigquery_table.clean_feeds_pms projects/${var.project-id}/datasets/thingspeak/tables/clean_feeds_pms
