resource "google_storage_bucket" "airqo_historic_data_bucket" {
  force_destroy            = false
  location                 = "US"
  name                     = "airqo_historic_data_bucket"
  project                  = "airqo-250220"
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.airqo_historic_data_bucket airqo_historic_data_bucket
