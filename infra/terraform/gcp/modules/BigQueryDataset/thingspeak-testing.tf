resource "google_bigquery_dataset" "thingspeak_testing" {
  access {
    role          = "OWNER"
    special_group = "projectOwners"
  }
  
  access {
    role          = "READER"
    special_group = "projectReaders"
  }

  access {
    role          = "WRITER"
    special_group = "projectWriters"
  }

  dataset_id                 = "thingspeak_testing"
  delete_contents_on_destroy = false
  location                   = "US"
  project                    = var.project-id
}
# terraform import google_bigquery_dataset.thingspeak_testing projects/${var.project-id}/datasets/thingspeak_testing
