resource "google_bigquery_table" "device_gps_values" {
  dataset_id = "thingspeak"
  project    = "${var.project-id}"
  schema     = "[{\"mode\":\"NULLABLE\",\"name\":\"field5\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"field6\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"channel_id\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"tot\",\"type\":\"INTEGER\"},{\"mode\":\"NULLABLE\",\"name\":\"rn\",\"type\":\"INTEGER\"}]"
  table_id   = "device_gps_values"
}
# terraform import google_bigquery_table.device_gps_values projects/airqo-250220/datasets/thingspeak/tables/device_gps_values
