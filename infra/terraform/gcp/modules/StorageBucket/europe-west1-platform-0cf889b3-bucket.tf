resource "google_storage_bucket" "europe_west1_platform_0cf889b3_bucket" {
  force_destroy = false

  labels = {
    goog-composer-environment = "platform"
    goog-composer-location    = "europe-west1"
    goog-composer-version     = "composer-1-8-3-airflow-1-9-0"
  }

  location                 = "EUROPE-WEST1"
  name                     = "europe-west1-platform-0cf889b3-bucket"
  project                  = var.project-id
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.europe_west1_platform_0cf889b3_bucket europe-west1-platform-0cf889b3-bucket
