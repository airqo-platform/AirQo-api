resource "google_storage_bucket" "firestore_airqo_backup" {
  force_destroy = false

  lifecycle_rule {
    action {
      type = "Delete"
    }

    condition {
      age        = 30
      with_state = "ANY"
    }
  }

  location                    = "US"
  name                        = "firestore_airqo_backup"
  project                     = "airqo-250220"
  # Argument "public_access_prevention" not expected here.
# public_access_prevention    = "inherited"
  storage_class               = "NEARLINE"
  uniform_bucket_level_access = true
}
# terraform import google_storage_bucket.firestore_airqo_backup firestore_airqo_backup
