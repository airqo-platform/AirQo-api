resource "google_secret_manager_secret" "admin_mongodb_connection_strings" {
  project = "${var.project-number}"

  replication {
    automatic = true
  }

  rotation {
    next_rotation_time = "2022-09-27T21:00:00Z"
    rotation_period    = "2592000s"
  }

  secret_id = "admin-mongodb-connection-strings"

  topics {
    name = "projects/${var.project-id}/topics/secrets-manager"
  }
}
# terraform import google_secret_manager_secret.admin_mongodb_connection_strings projects/${var.project-number}/secrets/admin-mongodb-connection-strings
