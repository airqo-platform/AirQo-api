resource "google_bigquery_dataset" "raw_data" {
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

  dataset_id                 = "raw_data"
  delete_contents_on_destroy = false
  location                   = "${var.location}"
  project                    = var.project-id
}
# terraform import google_bigquery_dataset.raw_data projects/${var.project-id}/datasets/raw_data
