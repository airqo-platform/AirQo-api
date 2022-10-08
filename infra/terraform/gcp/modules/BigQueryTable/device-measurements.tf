resource "google_bigquery_table" "device_measurements" {
  clustering = ["device_number", "device_id", "timestamp"]
  dataset_id = "raw_data"
  project    = var.project-id
  schema     = "[{\"mode\":\"NULLABLE\",\"name\":\"tenant\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"timestamp\",\"type\":\"TIMESTAMP\"},{\"mode\":\"NULLABLE\",\"name\":\"site_id\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"device_number\",\"type\":\"INTEGER\"},{\"mode\":\"NULLABLE\",\"name\":\"device_id\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"latitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"longitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"pm2_5\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"s1_pm2_5\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"s2_pm2_5\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"pm10\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"s1_pm10\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"s2_pm10\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"no2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"pm1\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"s1_pm1\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"s2_pm1\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"pressure\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"s1_pressure\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"s2_pressure\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"temperature\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"humidity\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"voc\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"s1_voc\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"s2_voc\",\"type\":\"FLOAT\"},{\"description\":\"m/s.\",\"mode\":\"NULLABLE\",\"name\":\"wind_speed\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"altitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"satellites\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"hdop\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"device_temperature\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"device_humidity\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"battery\",\"type\":\"FLOAT\"}]"
  table_id   = "device_measurements"

  time_partitioning {
    field                    = "timestamp"
    require_partition_filter = true
    type                     = "MONTH"
  }
}
# terraform import google_bigquery_table.device_measurements projects/${var.project-id}/datasets/raw_data/tables/device_measurements
