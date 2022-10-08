resource "google_bigquery_table" "dataprep_table" {
  dataset_id = "thingspeak"
  project    = "${var.project-id}"
  schema     = "[{\"mode\":\"NULLABLE\",\"name\":\"created_at\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"entry_id\",\"type\":\"INTEGER\"},{\"mode\":\"NULLABLE\",\"name\":\"field1\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"field2\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"field3\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"field4\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"field5\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"field6\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"field7\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"field8\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"channel_id\",\"type\":\"STRING\"}]"
  table_id   = "dataprep_table"
}
# terraform import google_bigquery_table.dataprep_table projects/airqo-250220/datasets/thingspeak/tables/dataprep_table
