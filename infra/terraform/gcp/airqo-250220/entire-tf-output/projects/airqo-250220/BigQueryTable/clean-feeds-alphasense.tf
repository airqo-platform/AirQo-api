resource "google_bigquery_table" "clean_feeds_alphasense" {
  dataset_id = "thingspeak"
  project    = "airqo-250220"
  schema     = "[{\"name\":\"created_at\",\"type\":\"DATETIME\"},{\"name\":\"channel_id\",\"type\":\"INTEGER\"},{\"name\":\"entry_id\",\"type\":\"INTEGER\"},{\"name\":\"pm1\",\"type\":\"FLOAT\"},{\"name\":\"pm2_5\",\"type\":\"FLOAT\"},{\"name\":\"pm10\",\"type\":\"FLOAT\"},{\"name\":\"sample_period\",\"type\":\"FLOAT\"},{\"name\":\"latitude\",\"type\":\"FLOAT\"},{\"name\":\"longitude\",\"type\":\"FLOAT\"},{\"name\":\"voltage\",\"type\":\"FLOAT\"},{\"name\":\"altitude\",\"type\":\"FLOAT\"},{\"name\":\"field0\",\"type\":\"FLOAT\"},{\"name\":\"field1\",\"type\":\"FLOAT\"},{\"name\":\"field2\",\"type\":\"FLOAT\"}]"
  table_id   = "clean_feeds_alphasense"
}
# terraform import google_bigquery_table.clean_feeds_alphasense projects/airqo-250220/datasets/thingspeak/tables/clean_feeds_alphasense
