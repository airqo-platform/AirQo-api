resource "google_bigquery_table" "feeds" {
  dataset_id = "thingspeak"
  project    = var.project-id
  schema     = "[{\"name\":\"created_at\",\"type\":\"STRING\"},{\"name\":\"entry_id\",\"type\":\"INTEGER\"},{\"name\":\"field1\",\"type\":\"STRING\"},{\"name\":\"field2\",\"type\":\"STRING\"},{\"name\":\"field3\",\"type\":\"STRING\"},{\"name\":\"field4\",\"type\":\"STRING\"},{\"name\":\"field5\",\"type\":\"STRING\"},{\"name\":\"field6\",\"type\":\"STRING\"},{\"name\":\"field7\",\"type\":\"STRING\"},{\"name\":\"field8\",\"type\":\"STRING\"},{\"name\":\"channel_id\",\"type\":\"STRING\"}]"
  table_id   = "feeds"
}
# terraform import google_bigquery_table.feeds projects/${var.project-id}/datasets/thingspeak/tables/feeds
