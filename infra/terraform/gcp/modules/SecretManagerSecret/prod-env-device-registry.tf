resource "google_secret_manager_secret" "prod_env_device_registry" {
  project = var.project-number

  replication {
    automatic = true
  }

  rotation {
    next_rotation_time = "2022-09-27T21:00:00Z"
    rotation_period    = "2592000s"
  }

  secret_id = "prod-env-device-registry"

  topics {
    name = "projects/${var.project-id}/topics/secrets-manager"
  }
}
# terraform import google_secret_manager_secret.prod_env_device_registry projects/${var.project-number}/secrets/prod-env-device-registry
