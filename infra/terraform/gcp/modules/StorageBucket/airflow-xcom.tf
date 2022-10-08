resource "google_storage_bucket" "airflow_xcom" {
  force_destroy = false

  lifecycle_rule {
    action {
      type = "Delete"
    }

    condition {
      age        = 2
      with_state = "ANY"
    }
  }

  location                    = "EU"
  name                        = "airflow_xcom"
  project                     = "${var.project-id}"
  # Argument "public_access_prevention" not expected here.
# public_access_prevention    = "inherited"
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
}
# terraform import google_storage_bucket.airflow_xcom airflow_xcom
