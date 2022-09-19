resource "google_bigquery_table" "clean_hourly_feeds_pms" {
  dataset_id = "thingspeak"
  project    = "airqo-250220"
  schema     = "[{\"mode\":\"REQUIRED\",\"name\":\"channel_id\",\"type\":\"INTEGER\"},{\"mode\":\"NULLABLE\",\"name\":\"s1_pm2_5\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"s1_pm10\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"s2_pm2_5\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"s2_pm10\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"latitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"longitude\",\"type\":\"FLOAT\"},{\"mode\":\"REQUIRED\",\"name\":\"created_at\",\"type\":\"DATETIME\"},{\"mode\":\"REQUIRED\",\"name\":\"time\",\"type\":\"DATETIME\"},{\"name\":\"s1_s2_average_pm2_5\",\"type\":\"FLOAT\"},{\"name\":\"s1_s2_average_pm10\",\"type\":\"FLOAT\"}]"
  table_id   = "clean_hourly_feeds_pms"
}
# terraform import google_bigquery_table.clean_hourly_feeds_pms projects/airqo-250220/datasets/thingspeak/tables/clean_hourly_feeds_pms
