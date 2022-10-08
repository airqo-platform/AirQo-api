resource "google_bigquery_table" "geographical_data" {
  dataset_id = "metadata"
  project    = var.project-id
  schema     = "[{\"mode\":\"NULLABLE\",\"name\":\"district_code\",\"type\":\"INTEGER\"},{\"mode\":\"NULLABLE\",\"name\":\"district\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"region\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"country\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"country_code\",\"type\":\"INTEGER\"}]"
  table_id   = "geographical_data"
}
# terraform import google_bigquery_table.geographical_data projects/${var.project-id}/datasets/metadata/tables/geographical_data
