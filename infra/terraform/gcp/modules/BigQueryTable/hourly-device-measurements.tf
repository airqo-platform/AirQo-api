resource "google_bigquery_table" "hourly_device_measurements" {
  clustering = ["tenant", "site_id", "device", "timestamp"]
  dataset_id = "averaged_data"
  project    = "${var.project-id}"
  schema     = "[{\"mode\":\"NULLABLE\",\"name\":\"tenant\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"timestamp\",\"type\":\"TIMESTAMP\"},{\"mode\":\"NULLABLE\",\"name\":\"site_id\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"device_number\",\"type\":\"INTEGER\"},{\"mode\":\"NULLABLE\",\"name\":\"device\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"latitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"longitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"pm2_5\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"s1_pm2_5\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"s2_pm2_5\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"pm2_5_raw_value\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"pm2_5_calibrated_value\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"pm10\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"s1_pm10\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"s2_pm10\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"pm10_raw_value\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"pm10_calibrated_value\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"no2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"no2_raw_value\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"no2_calibrated_value\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"pm1\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"pm1_raw_value\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"pm1_calibrated_value\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"external_temperature\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"external_humidity\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"wind_speed\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"altitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"device_id\",\"type\":\"STRING\"}]"
  table_id   = "hourly_device_measurements"

  time_partitioning {
    field                    = "timestamp"
    require_partition_filter = true
    type                     = "MONTH"
  }
}
# terraform import google_bigquery_table.hourly_device_measurements projects/airqo-250220/datasets/averaged_data/tables/hourly_device_measurements
