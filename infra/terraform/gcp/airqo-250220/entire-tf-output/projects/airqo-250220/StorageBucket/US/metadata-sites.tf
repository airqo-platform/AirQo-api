resource "google_storage_bucket" "metadata_sites" {
  force_destroy               = false
  location                    = "US"
  name                        = "metadata_sites"
  project                     = "airqo-250220"
  # Argument "public_access_prevention" not expected here.
# public_access_prevention    = "inherited"
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
}
# terraform import google_storage_bucket.metadata_sites metadata_sites
