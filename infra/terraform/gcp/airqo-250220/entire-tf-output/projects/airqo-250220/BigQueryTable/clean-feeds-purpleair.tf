resource "google_bigquery_table" "clean_feeds_purpleair" {
  dataset_id = "thingspeak"
  project    = "airqo-250220"
  schema     = "[{\"name\":\"created_at\",\"type\":\"DATETIME\"},{\"name\":\"channel_id\",\"type\":\"INTEGER\"},{\"name\":\"entry_id\",\"type\":\"INTEGER\"},{\"name\":\"pm1\",\"type\":\"FLOAT\"},{\"name\":\"pm2_5\",\"type\":\"FLOAT\"},{\"name\":\"pm10\",\"type\":\"FLOAT\"},{\"name\":\"uptime\",\"type\":\"INTEGER\"},{\"name\":\"RSSI\",\"type\":\"INTEGER\"},{\"name\":\"temperature\",\"type\":\"FLOAT\"},{\"name\":\"humidity\",\"type\":\"FLOAT\"},{\"name\":\"pm2_5_cf1\",\"type\":\"FLOAT\"}]"
  table_id   = "clean_feeds_purpleair"
}
# terraform import google_bigquery_table.clean_feeds_purpleair projects/airqo-250220/datasets/thingspeak/tables/clean_feeds_purpleair
