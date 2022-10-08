resource "google_secret_manager_secret" "sta_env_calibrate_app" {
  project = var.project-number

  replication {
    automatic = true
  }

  rotation {
    next_rotation_time = "2022-09-27T21:00:00Z"
    rotation_period    = "2592000s"
  }

  secret_id = "sta-env-calibrate-app"

  topics {
    name = "projects/${var.project-id}/topics/secrets-manager"
  }
}
# terraform import google_secret_manager_secret.sta_env_calibrate_app projects/${var.project-number}/secrets/sta-env-calibrate-app
