resource "google_bigquery_table" "devices_data" {
  dataset_id = "metadata"
  project    = var.project-id
  schema     = "[{\"mode\":\"REQUIRED\",\"name\":\"tenant\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"site_id\",\"type\":\"STRING\"},{\"description\":\"string that uniquely identifies a device in an organisation\",\"mode\":\"NULLABLE\",\"name\":\"device_id\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"device_manufacturer\",\"type\":\"STRING\"},{\"description\":\"integer that uniquely identifies a device in an organisation\",\"mode\":\"NULLABLE\",\"name\":\"device_number\",\"type\":\"INTEGER\"},{\"mode\":\"NULLABLE\",\"name\":\"device_name\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"latitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"longitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"category\",\"type\":\"STRING\"}]"
  table_id   = "devices_data"
}
# terraform import google_bigquery_table.devices_data projects/${var.project-id}/datasets/metadata/tables/devices_data
