resource "google_storage_bucket" "artifacts_airqo_frontend_appspot_com" {
  force_destroy            = false
  location                 = "US"
  name                     = "artifacts.airqo-frontend.appspot.com"
  project                  = "airqo-frontend"
  # Argument "public_access_prevention" not expected here.
# public_access_prevention = "inherited"
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.artifacts_airqo_frontend_appspot_com artifacts.airqo-frontend.appspot.com
