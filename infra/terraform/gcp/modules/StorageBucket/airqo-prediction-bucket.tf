resource "google_storage_bucket" "airqo_prediction_bucket" {
  force_destroy               = false
  location                    = "NAM4"
  name                        = "airqo_prediction_bucket"
  project                     = "${var.project-id}"
  # Argument "public_access_prevention" not expected here.
# public_access_prevention    = "inherited"
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
}
# terraform import google_storage_bucket.airqo_prediction_bucket airqo_prediction_bucket
