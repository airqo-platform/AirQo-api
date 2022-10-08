resource "google_bigquery_table" "bam_device_measurements" {
  clustering = ["device_number", "device_id", "timestamp"]
  dataset_id = "raw_data"
  project    = "${var.project-id}"
  schema     = "[{\"mode\":\"NULLABLE\",\"name\":\"tenant\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"site_id\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"device_number\",\"type\":\"INTEGER\"},{\"mode\":\"NULLABLE\",\"name\":\"device_id\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"timestamp\",\"type\":\"TIMESTAMP\"},{\"mode\":\"NULLABLE\",\"name\":\"latitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"longitude\",\"type\":\"FLOAT\"},{\"description\":\"μg/m3.\",\"mode\":\"NULLABLE\",\"name\":\"realtime_conc\",\"type\":\"FLOAT\"},{\"description\":\"μg/m3.\",\"mode\":\"NULLABLE\",\"name\":\"hourly_conc\",\"type\":\"FLOAT\"},{\"description\":\"μg/m3.\",\"mode\":\"NULLABLE\",\"name\":\"short_time_conc\",\"type\":\"FLOAT\"},{\"description\":\"Litres per minute. Amount of air flowing through\",\"mode\":\"NULLABLE\",\"name\":\"air_flow\",\"type\":\"FLOAT\"},{\"description\":\"m/s\",\"mode\":\"NULLABLE\",\"name\":\"wind_speed\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"wind_direction\",\"type\":\"FLOAT\"},{\"description\":\"degrees celsius. Ambient Temperature\",\"mode\":\"NULLABLE\",\"name\":\"temperature\",\"type\":\"FLOAT\"},{\"description\":\"%. External Relative Humidity\",\"mode\":\"NULLABLE\",\"name\":\"humidity\",\"type\":\"FLOAT\"},{\"description\":\"mmHg\",\"mode\":\"NULLABLE\",\"name\":\"barometric_pressure\",\"type\":\"FLOAT\"},{\"description\":\"degrees celsius. Filter Temperature\",\"mode\":\"NULLABLE\",\"name\":\"filter_temperature\",\"type\":\"FLOAT\"},{\"description\":\"%. Filter Relative Humidity\",\"mode\":\"NULLABLE\",\"name\":\"filter_humidity\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"status\",\"type\":\"INTEGER\"}]"
  table_id   = "bam_device_measurements"

  time_partitioning {
    field                    = "timestamp"
    require_partition_filter = true
    type                     = "MONTH"
  }
}
# terraform import google_bigquery_table.bam_device_measurements projects/airqo-250220/datasets/raw_data/tables/bam_device_measurements
