resource "google_bigquery_table" "unclean_mobile_device_measurements" {
  clustering = ["tenant", "device_number", "device_id"]
  dataset_id = "raw_data"
  project    = "${var.project-id}"
  schema     = "[{\"mode\":\"NULLABLE\",\"name\":\"tenant\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"timestamp\",\"type\":\"TIMESTAMP\"},{\"mode\":\"NULLABLE\",\"name\":\"device_number\",\"type\":\"INTEGER\"},{\"mode\":\"NULLABLE\",\"name\":\"device_id\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"latitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"longitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"horizontal_accuracy\",\"type\":\"FLOAT\"},{\"description\":\"μg/m3.\",\"mode\":\"NULLABLE\",\"name\":\"pm2_5\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"pm2_5_category\",\"type\":\"STRING\"},{\"description\":\"μg/m3.\",\"mode\":\"NULLABLE\",\"name\":\"pm1\",\"type\":\"FLOAT\"},{\"description\":\"μg/m3.\",\"mode\":\"NULLABLE\",\"name\":\"pm10\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"pm10_category\",\"type\":\"STRING\"},{\"description\":\"ppb.\",\"mode\":\"NULLABLE\",\"name\":\"no2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"no2_category\",\"type\":\"STRING\"},{\"description\":\"ppb.\",\"mode\":\"NULLABLE\",\"name\":\"voc\",\"type\":\"FLOAT\"},{\"description\":\"μg/m3.\",\"mode\":\"NULLABLE\",\"name\":\"pm1_pi\",\"type\":\"FLOAT\"},{\"description\":\"μg/m3.\",\"mode\":\"NULLABLE\",\"name\":\"pm2_5_pi\",\"type\":\"FLOAT\"},{\"description\":\"μg/m3.\",\"mode\":\"NULLABLE\",\"name\":\"pm10_pi\",\"type\":\"FLOAT\"},{\"description\":\"ppb.\",\"mode\":\"NULLABLE\",\"name\":\"voc_pi\",\"type\":\"FLOAT\"},{\"description\":\"ppb.\",\"mode\":\"NULLABLE\",\"name\":\"no2_pi\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"temperature\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"humidity\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"gps_device_timestamp\",\"type\":\"TIMESTAMP\"},{\"mode\":\"NULLABLE\",\"name\":\"timestamp_abs_diff\",\"type\":\"FLOAT\"}]"
  table_id   = "unclean_mobile_device_measurements"

  time_partitioning {
    field                    = "timestamp"
    require_partition_filter = true
    type                     = "MONTH"
  }
}
# terraform import google_bigquery_table.unclean_mobile_device_measurements projects/airqo-250220/datasets/raw_data/tables/unclean_mobile_device_measurements
