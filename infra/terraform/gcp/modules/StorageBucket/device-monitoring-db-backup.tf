resource "google_storage_bucket" "device_monitoring_db_backup" {
  force_destroy               = false
  location                    = "US"
  name                        = "device-monitoring-db-backup"
  project                     = "${var.project-id}"
  # Argument "public_access_prevention" not expected here.
# public_access_prevention    = "enforced"
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
}
# terraform import google_storage_bucket.device_monitoring_db_backup device-monitoring-db-backup
