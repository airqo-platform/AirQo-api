resource "google_bigquery_table" "uncalibrated_data" {
  dataset_id = "dev_dataset"
  project    = "${var.project-id}"
  schema     = "[{\"mode\":\"NULLABLE\",\"name\":\"timestamp\",\"type\":\"TIMESTAMP\"},{\"mode\":\"NULLABLE\",\"name\":\"site_id\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"device_number\",\"type\":\"INTEGER\"},{\"mode\":\"NULLABLE\",\"name\":\"latitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"longitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"s1_pm2_5\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"s2_pm2_5\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"s1_pm10\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"s2_pm10\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"no2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"pm1\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"wind_speed\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"altitude\",\"type\":\"FLOAT\"}]"
  table_id   = "uncalibrated_data"
}
# terraform import google_bigquery_table.uncalibrated_data projects/airqo-250220/datasets/dev_dataset/tables/uncalibrated_data
