resource "google_storage_bucket" "staging_airqo_frontend_appspot_com" {
  force_destroy = false

  lifecycle_rule {
    action {
      type = "Delete"
    }

    condition {
      age        = 15
      with_state = "ANY"
    }
  }

  location                 = "US"
  name                     = "staging.airqo-frontend.appspot.com"
  project                  = "airqo-frontend"
  # Argument "public_access_prevention" not expected here.
# public_access_prevention = "inherited"
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.staging_airqo_frontend_appspot_com staging.airqo-frontend.appspot.com
