resource "google_storage_bucket" "airqo_250220_bucket" {
  force_destroy               = false
  location                    = "US"
  name                        = "${var.project-id}-bucket"
  project                     = "${var.project-id}"
  # Argument "public_access_prevention" not expected here.
# public_access_prevention    = "inherited"
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
}
# terraform import google_storage_bucket.airqo_250220_bucket airqo-250220-bucket
