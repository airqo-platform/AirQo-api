resource "google_bigquery_table" "mytable" {
  dataset_id = "raw_data_stage"

  external_data_configuration {
    autodetect    = true
    connection_id = "${var.project-number}.eu.demo_lake"

    csv_options {
      quote             = ""
      field_delimiter   = ","
      skip_leading_rows = 0
    }

    source_format = "CSV"
    source_uris   = ["gs://airqo_raw_data/unclean_airqo_bam_data.csv"]
  }

  project  = var.project-id
  schema   = "[{\"mode\":\"NULLABLE\",\"name\":\"temperature\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"device_id\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"hourly_conc\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"device_number\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"air_flow\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"filter_humidity\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"status\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"longitude\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"realtime_conc\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"filter_temperature\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"wind_direction\",\"type\":\"INTEGER\"},{\"mode\":\"NULLABLE\",\"name\":\"timestamp\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"humidity\",\"type\":\"INTEGER\"},{\"mode\":\"NULLABLE\",\"name\":\"wind_speed\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"latitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"barometric_pressure\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"site_id\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"short_time_conc\",\"type\":\"FLOAT\"}]"
  table_id = "mytable"
}
# terraform import google_bigquery_table.mytable projects/${var.project-id}/datasets/raw_data_stage/tables/mytable
