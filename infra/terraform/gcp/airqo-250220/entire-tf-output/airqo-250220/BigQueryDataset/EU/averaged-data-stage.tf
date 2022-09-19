resource "google_bigquery_dataset" "averaged_data_stage" {
  access {
    role          = "OWNER"
    special_group = "projectOwners"
  }

  access {
    role          = "OWNER"
    user_by_email = "noah@airqo.net"
  }

  access {
    role          = "READER"
    special_group = "projectReaders"
  }

  access {
    role          = "WRITER"
    special_group = "projectWriters"
  }

  dataset_id                 = "averaged_data_stage"
  delete_contents_on_destroy = false
  location                   = "EU"
  project                    = "airqo-250220"
}
# terraform import google_bigquery_dataset.averaged_data_stage projects/airqo-250220/datasets/averaged_data_stage
