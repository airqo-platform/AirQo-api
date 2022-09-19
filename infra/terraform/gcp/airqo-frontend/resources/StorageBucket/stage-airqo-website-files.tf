resource "google_storage_bucket" "stage_airqo_website_files" {
  force_destroy               = false
  location                    = "US"
  name                        = "stage-airqo-website-files"
  project                     = "airqo-frontend"
  # Argument "public_access_prevention" not expected here.
# public_access_prevention    = "inherited"
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
}
# terraform import google_storage_bucket.stage_airqo_website_files stage-airqo-website-files
