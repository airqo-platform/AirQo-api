resource "google_storage_bucket" "airqo_historic_data_bucket" {
  force_destroy            = false
  location                 = var.location
  name                     = "airqo_historic_data_bucket"
  project                  = var.project-id
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.airqo_historic_data_bucket airqo_historic_data_bucket
