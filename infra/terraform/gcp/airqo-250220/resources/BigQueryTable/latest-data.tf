resource "google_bigquery_table" "latest_data" {
  clustering = ["tenant", "site_id", "device_number", "device_id"]
  dataset_id = "view_data_stage"
  project    = "airqo-250220"
  schema     = "[{\"mode\":\"NULLABLE\",\"name\":\"tenant\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"timestamp\",\"type\":\"TIMESTAMP\"},{\"mode\":\"NULLABLE\",\"name\":\"device_id\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"device_number\",\"type\":\"INTEGER\"},{\"mode\":\"NULLABLE\",\"name\":\"site_id\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"frequency\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"id\",\"type\":\"STRING\"}]"
  table_id   = "latest_data"

  time_partitioning {
    field                    = "timestamp"
    require_partition_filter = true
    type                     = "HOUR"
  }
}
# terraform import google_bigquery_table.latest_data projects/airqo-250220/datasets/view_data_stage/tables/latest_data
