resource "google_storage_bucket" "airflow_logs_production" {
  force_destroy = false

  lifecycle_rule {
    action {
      type = "Delete"
    }

    condition {
      age        = 4
      with_state = "ANY"
    }
  }

  location                    = "EU"
  name                        = "airflow_logs_production"
  project                     = "airqo-250220"
  # Argument "public_access_prevention" not expected here.
# public_access_prevention    = "inherited"
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
}
# terraform import google_storage_bucket.airflow_logs_production airflow_logs_production
