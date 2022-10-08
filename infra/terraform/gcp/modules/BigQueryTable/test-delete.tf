resource "google_bigquery_table" "test_delete" {
  dataset_id = "thingspeak_testing"
  project    = "${var.project-id}"
  schema     = "null"
  table_id   = "test_delete"
}
# terraform import google_bigquery_table.test_delete projects/airqo-250220/datasets/thingspeak_testing/tables/test_delete
