resource "google_bigquery_dataset" "thingspeak" {
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

  access {
    role          = "WRITER"
    user_by_email = "service-${var.project-number}@gcp-sa-bigquerydatatransfer.iam.gserviceaccount.com"
  }

  dataset_id                 = "thingspeak"
  delete_contents_on_destroy = false
  location                   = "US"
  project                    = var.project-id
}
# terraform import google_bigquery_dataset.thingspeak projects/${var.project-id}/datasets/thingspeak
