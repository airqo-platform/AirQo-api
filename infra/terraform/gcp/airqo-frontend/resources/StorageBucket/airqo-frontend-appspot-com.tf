resource "google_storage_bucket" "airqo_frontend_appspot_com" {
  force_destroy            = false
  location                 = "US"
  name                     = "airqo-frontend.appspot.com"
  project                  = "airqo-frontend"
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.airqo_frontend_appspot_com airqo-frontend.appspot.com
