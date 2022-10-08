resource "google_bigquery_table" "feeeds_2020_10_01_to_2020_12_31" {
  dataset_id = "thingspeak"
  project    = "${var.project-id}"
  schema     = "[{\"mode\":\"NULLABLE\",\"name\":\"created_at\",\"type\":\"DATETIME\"},{\"mode\":\"NULLABLE\",\"name\":\"channel_id\",\"type\":\"INTEGER\"},{\"mode\":\"NULLABLE\",\"name\":\"entry_id\",\"type\":\"INTEGER\"},{\"mode\":\"NULLABLE\",\"name\":\"pm2_5\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"pm10\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"s2_pm2_5\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"s2_pm10\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"latitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"longitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"voltage\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"altitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"wind\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"no_sats\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"hdope\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"temperature\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"humidity\",\"type\":\"FLOAT\"}]"
  table_id   = "feeeds-2020-10-01-to-2020-12-31"
}
# terraform import google_bigquery_table.feeeds_2020_10_01_to_2020_12_31 projects/airqo-250220/datasets/thingspeak/tables/feeeds-2020-10-01-to-2020-12-31
