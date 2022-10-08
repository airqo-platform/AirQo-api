resource "google_bigquery_table" "weather_data" {
  clustering = ["station_code", "timestamp"]
  dataset_id = "raw_data"
  project    = "${var.project-id}"
  schema     = "[{\"mode\":\"REQUIRED\",\"name\":\"station_code\",\"type\":\"STRING\"},{\"mode\":\"REQUIRED\",\"name\":\"timestamp\",\"type\":\"TIMESTAMP\"},{\"description\":\"°C.\",\"mode\":\"NULLABLE\",\"name\":\"temperature\",\"type\":\"FLOAT\"},{\"description\":\"%.\",\"mode\":\"NULLABLE\",\"name\":\"humidity\",\"type\":\"FLOAT\"},{\"description\":\"m/s.\",\"mode\":\"NULLABLE\",\"name\":\"wind_speed\",\"type\":\"FLOAT\"},{\"description\":\"kPa.\",\"mode\":\"NULLABLE\",\"name\":\"atmospheric_pressure\",\"type\":\"FLOAT\"},{\"description\":\"W/m2.\",\"mode\":\"NULLABLE\",\"name\":\"radiation\",\"type\":\"FLOAT\"},{\"description\":\"kPa.\",\"mode\":\"NULLABLE\",\"name\":\"vapor_pressure\",\"type\":\"FLOAT\"},{\"description\":\"m/s.\",\"mode\":\"NULLABLE\",\"name\":\"wind_gusts\",\"type\":\"FLOAT\"},{\"description\":\"mm.\",\"mode\":\"NULLABLE\",\"name\":\"precipitation\",\"type\":\"FLOAT\"},{\"description\":\"degrees\",\"mode\":\"NULLABLE\",\"name\":\"wind_direction\",\"type\":\"FLOAT\"}]"
  table_id   = "weather_data"

  time_partitioning {
    field                    = "timestamp"
    require_partition_filter = true
    type                     = "MONTH"
  }
}
# terraform import google_bigquery_table.weather_data projects/airqo-250220/datasets/raw_data/tables/weather_data
