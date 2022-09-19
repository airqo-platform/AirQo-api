resource "google_storage_bucket" "prod_metadata_sites" {
  force_destroy               = false
  location                    = "EU"
  name                        = "prod-metadata-sites"
  project                     = "airqo-250220"
  # Argument "public_access_prevention" not expected here.
# public_access_prevention    = "inherited"
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
}
# terraform import google_storage_bucket.prod_metadata_sites prod-metadata-sites
