resource "google_storage_bucket" "staging_airqo_250220_appspot_com" {
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
  name                     = "staging.airqo-250220.appspot.com"
  project                  = "${var.project-id}"
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.staging_airqo_250220_appspot_com staging.airqo-250220.appspot.com
