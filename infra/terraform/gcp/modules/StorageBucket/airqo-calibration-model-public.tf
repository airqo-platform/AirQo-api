resource "google_storage_bucket" "airqo_calibration_model_public" {
  force_destroy               = false
  location                    = "EUROPE-WEST1"
  name                        = "airqo_calibration_model_public"
  project                     = var.project-id
  # Argument "public_access_prevention" not expected here.
# public_access_prevention    = "inherited"
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
}
# terraform import google_storage_bucket.airqo_calibration_model_public airqo_calibration_model_public
