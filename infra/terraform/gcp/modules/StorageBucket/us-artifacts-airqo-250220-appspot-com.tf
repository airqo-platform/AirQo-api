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

  location                 = var.location
  name                     = "us.artifacts.${var.project-id}.appspot.com"
  project                  = var.project-id
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.us_artifacts_airqo_250220_appspot_com us.artifacts.${var.project-id}.appspot.com
