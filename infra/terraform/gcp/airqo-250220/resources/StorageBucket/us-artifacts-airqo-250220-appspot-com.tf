resource "google_storage_bucket" "us_artifacts_airqo_250220_appspot_com" {
  force_destroy = false

  lifecycle_rule {
    action {
      storage_class = "NEARLINE"
      type          = "SetStorageClass"
    }

    condition {
      age        = 30
      with_state = "ANY"
    }
  }

  lifecycle_rule {
    action {
      storage_class = "ARCHIVE"
      type          = "SetStorageClass"
    }

    condition {
      age        = 90
      with_state = "ANY"
    }
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }

    condition {
      age        = 365
      with_state = "ANY"
    }
  }

  location                 = "US"
  name                     = "us.artifacts.airqo-250220.appspot.com"
  project                  = "airqo-250220"
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.us_artifacts_airqo_250220_appspot_com us.artifacts.airqo-250220.appspot.com
