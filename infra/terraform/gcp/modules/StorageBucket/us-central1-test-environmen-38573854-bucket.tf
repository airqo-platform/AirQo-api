resource "google_storage_bucket" "us_central1_test_environmen_38573854_bucket" {
  force_destroy = false

  labels = {
    goog-composer-environment = "test-environment"
    goog-composer-location    = "us-central1"
    goog-composer-version     = "composer-1-14-2-airflow-1-10-12"
  }

  location                 = "US-CENTRAL1"
  name                     = "us-central1-test-environmen-38573854-bucket"
  project                  = "${var.project-id}"
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.us_central1_test_environmen_38573854_bucket us-central1-test-environmen-38573854-bucket
