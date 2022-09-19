resource "google_bigquery_table" "mobile_device_measurements" {
  clustering = ["device_number", "device_id", "timestamp"]
  dataset_id = "raw_data"
  project    = "airqo-250220"
  schema     = "[{\"mode\":\"NULLABLE\",\"name\":\"tenant\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"timestamp\",\"type\":\"TIMESTAMP\"},{\"mode\":\"NULLABLE\",\"name\":\"device_number\",\"type\":\"INTEGER\"},{\"mode\":\"NULLABLE\",\"name\":\"device_id\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"latitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"longitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"horizontal_accuracy\",\"type\":\"FLOAT\"},{\"description\":\"μg/m3.\",\"mode\":\"NULLABLE\",\"name\":\"pm2_5_raw_value\",\"type\":\"FLOAT\"},{\"description\":\"μg/m3.\",\"mode\":\"NULLABLE\",\"name\":\"pm1_raw_value\",\"type\":\"FLOAT\"},{\"description\":\"μg/m3.\",\"mode\":\"NULLABLE\",\"name\":\"pm10_raw_value\",\"type\":\"FLOAT\"},{\"description\":\"ppb.\",\"mode\":\"NULLABLE\",\"name\":\"no2_raw_value\",\"type\":\"FLOAT\"},{\"description\":\"ppb.\",\"mode\":\"NULLABLE\",\"name\":\"voc_raw_value\",\"type\":\"FLOAT\"},{\"description\":\"μg/m3.\",\"mode\":\"NULLABLE\",\"name\":\"pm1_pi_value\",\"type\":\"FLOAT\"},{\"description\":\"μg/m3.\",\"mode\":\"NULLABLE\",\"name\":\"pm2_5_pi_value\",\"type\":\"FLOAT\"},{\"description\":\"μg/m3.\",\"mode\":\"NULLABLE\",\"name\":\"pm10_pi_value\",\"type\":\"FLOAT\"},{\"description\":\"ppb.\",\"mode\":\"NULLABLE\",\"name\":\"voc_pi_value\",\"type\":\"FLOAT\"},{\"description\":\"ppb.\",\"mode\":\"NULLABLE\",\"name\":\"no2_pi_value\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"gps_device_timestamp\",\"type\":\"TIMESTAMP\"},{\"mode\":\"NULLABLE\",\"name\":\"timestamp_abs_diff\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"no2_raw_value_aqi\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"pm10_raw_value_aqi\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"pm2_5_raw_value_aqi\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"temperature\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"humidity\",\"type\":\"FLOAT\"}]"
  table_id   = "mobile_device_measurements"

  time_partitioning {
    field                    = "timestamp"
    require_partition_filter = true
    type                     = "MONTH"
  }
}
# terraform import google_bigquery_table.mobile_device_measurements projects/airqo-250220/datasets/raw_data/tables/mobile_device_measurements
