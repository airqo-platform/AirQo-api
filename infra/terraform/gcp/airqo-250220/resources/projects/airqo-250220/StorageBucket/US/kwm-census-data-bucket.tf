resource "google_storage_bucket" "kwm_census_data_bucket" {
  force_destroy            = false
  location                 = "US"
  name                     = "kwm-census-data-bucket"
  project                  = "airqo-250220"
  # Argument "public_access_prevention" not expected here.
# public_access_prevention = "inherited"
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.kwm_census_data_bucket kwm-census-data-bucket
