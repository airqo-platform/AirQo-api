resource "google_bigquery_table" "airqo_bam_data" {
  dataset_id = "thingspeak"
  project    = "${var.project-id}"
  schema     = "[{\"mode\":\"NULLABLE\",\"name\":\"Time\",\"type\":\"DATETIME\"},{\"mode\":\"NULLABLE\",\"name\":\"ConcRT_ug_m3\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"ConcHR_ug_m3\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"ConcS_ug_m3\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Flow_lpm\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"WS_m_s\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"WD_Deg\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"AT_C\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"RH\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"BP_mmHg\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"FT_C\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"FRH\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Status\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"latitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"longitude\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"channel_id\",\"type\":\"INTEGER\"}]"
  table_id   = "airqo_bam_data"
}
# terraform import google_bigquery_table.airqo_bam_data projects/airqo-250220/datasets/thingspeak/tables/airqo_bam_data
