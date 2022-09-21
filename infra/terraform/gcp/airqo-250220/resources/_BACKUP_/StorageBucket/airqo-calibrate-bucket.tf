resource "google_storage_bucket" "airqo_calibrate_bucket" {
  force_destroy               = false
  location                    = "US"
  name                        = "airqo_calibrate_bucket"
  project                     = "airqo-250220"
  # Argument "public_access_prevention" not expected here.
# public_access_prevention    = "inherited"
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
}
# terraform import google_storage_bucket.airqo_calibrate_bucket airqo_calibrate_bucket
