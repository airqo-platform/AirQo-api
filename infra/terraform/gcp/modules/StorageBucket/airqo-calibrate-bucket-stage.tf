resource "google_storage_bucket" "airqo_calibrate_bucket_stage" {
  force_destroy               = false
  location                    = var.location
  name                        = "airqo_calibrate_bucket_stage"
  project                     = var.project-id
  ## Argument "public_access_prevention" not expected here.
  # public_access_prevention    = "inherited"
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
}
# terraform import google_storage_bucket.airqo_calibrate_bucket_stage airqo_calibrate_bucket_stage
