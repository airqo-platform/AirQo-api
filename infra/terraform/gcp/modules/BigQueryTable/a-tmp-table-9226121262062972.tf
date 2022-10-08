resource "google_bigquery_table" "a___tmp___table_9226121262062972" {
  dataset_id = "thingspeak"
  project    = var.project-id
  table_id   = "___tmp___table_9226121262062972"
}
# terraform import google_bigquery_table.a___tmp___table_9226121262062972 projects/${var.project-id}/datasets/thingspeak/tables/___tmp___table_9226121262062972
