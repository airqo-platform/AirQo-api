resource "google_bigquery_dataset" "consolidated_data_stage" {
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

  dataset_id                 = "consolidated_data_stage"
  delete_contents_on_destroy = false
  location                   = "EU"
  project                    = "airqo-250220"
}
# terraform import google_bigquery_dataset.consolidated_data_stage projects/airqo-250220/datasets/consolidated_data_stage
