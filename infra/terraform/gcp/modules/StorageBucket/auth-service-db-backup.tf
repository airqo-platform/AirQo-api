resource "google_storage_bucket" "auth_service_db_backup" {
  force_destroy = false

  lifecycle_rule {
    action {
      storage_class = "NEARLINE"
      type          = "SetStorageClass"
    }

    condition {
      age        = 7
      with_state = "ANY"
    }
  }

  lifecycle_rule {
    action {
      storage_class = "COLDLINE"
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
      age        = 180
      with_state = "ANY"
    }
  }

  location                    = "US"
  name                        = "auth-service-db-backup"
  project                     = var.project-id
  # Argument "public_access_prevention" not expected here.
# public_access_prevention    = "enforced"
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
}
# terraform import google_storage_bucket.auth_service_db_backup auth-service-db-backup
