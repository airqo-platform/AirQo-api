resource "google_storage_bucket" "kwm_census_data_bucket" {
  force_destroy            = false
  location                 = var.location
  name                     = "kwm-census-data-bucket"
  project                  = var.project-id
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.kwm_census_data_bucket kwm-census-data-bucket
