resource "google_bigquery_table" "new_data_pms" {
  dataset_id = "thingspeak"
  project    = "${var.project-id}"
  schema     = "[{\"mode\":\"NULLABLE\",\"name\":\"created_at\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"entry_id\",\"type\":\"INTEGER\"},{\"mode\":\"NULLABLE\",\"name\":\"field1\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"field2\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"field3\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"field4\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"field5\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"field6\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"field7\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"field8\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"channel_id\",\"type\":\"STRING\"}]"
  table_id   = "new_data_pms"
}
# terraform import google_bigquery_table.new_data_pms projects/airqo-250220/datasets/thingspeak/tables/new_data_pms
