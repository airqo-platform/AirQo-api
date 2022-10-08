resource "google_storage_bucket" "airqo_raw_data" {
  force_destroy               = false
  location                    = "${var.location}"
  name                        = "airqo_raw_data"
  project                     = var.project-id
  # Argument "public_access_prevention" not expected here.
# public_access_prevention    = "inherited"
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
}
# terraform import google_storage_bucket.airqo_raw_data airqo_raw_data
