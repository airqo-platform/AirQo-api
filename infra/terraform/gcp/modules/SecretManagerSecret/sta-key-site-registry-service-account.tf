resource "google_secret_manager_secret" "sta_key_site_registry_service_account" {
  project = "${var.project-number}"

  replication {
    automatic = true
  }

  rotation {
    next_rotation_time = "2022-09-27T21:00:00Z"
    rotation_period    = "2592000s"
  }

  secret_id = "sta-key-site-registry-service-account"

  topics {
    name = "projects/${var.project-id}/topics/secrets-manager"
  }
}
# terraform import google_secret_manager_secret.sta_key_site_registry_service_account projects/${var.project-number}/secrets/sta-key-site-registry-service-account
