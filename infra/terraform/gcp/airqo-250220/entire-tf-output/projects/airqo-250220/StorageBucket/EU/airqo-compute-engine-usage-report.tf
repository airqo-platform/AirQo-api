resource "google_storage_bucket" "airqo_compute_engine_usage_report" {
  force_destroy               = false
  location                    = "EU"
  name                        = "airqo_compute_engine_usage_report"
  project                     = "airqo-250220"
  # Argument "public_access_prevention" not expected here.
# public_access_prevention    = "enforced"
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
}
# terraform import google_storage_bucket.airqo_compute_engine_usage_report airqo_compute_engine_usage_report
