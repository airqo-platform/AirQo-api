resource "google_bigquery_table" "sensor_positions" {
  clustering = ["device_number", "timestamp"]
  dataset_id = "raw_data"
  project    = "${var.project-id}"
  schema     = "[{\"mode\":\"NULLABLE\",\"name\":\"tenant\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"timestamp\",\"type\":\"TIMESTAMP\"},{\"mode\":\"NULLABLE\",\"name\":\"device_number\",\"type\":\"INTEGER\"},{\"mode\":\"NULLABLE\",\"name\":\"device_id\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"latitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"longitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"horizontal_accuracy\",\"type\":\"FLOAT\"}]"
  table_id   = "sensor_positions"

  time_partitioning {
    field                    = "timestamp"
    require_partition_filter = true
    type                     = "MONTH"
  }
}
# terraform import google_bigquery_table.sensor_positions projects/airqo-250220/datasets/raw_data/tables/sensor_positions
