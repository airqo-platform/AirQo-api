resource "google_storage_bucket" "airqo_open_data" {
  force_destroy               = false
  location                    = "EU"
  name                        = "airqo_open_data"
  project                     = "airqo-250220"
  # Argument "public_access_prevention" not expected here.
# public_access_prevention    = "inherited"
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
}
# terraform import google_storage_bucket.airqo_open_data airqo_open_data
