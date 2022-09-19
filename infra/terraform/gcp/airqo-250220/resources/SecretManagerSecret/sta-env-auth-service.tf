resource "google_secret_manager_secret" "sta_env_auth_service" {
  project = "702081712633"

  replication {
    automatic = true
  }

  rotation {
    next_rotation_time = "2022-10-11T21:00:00Z"
    rotation_period    = "2592000s"
  }

  secret_id = "sta-env-auth-service"

  topics {
    name = "projects/airqo-250220/topics/secrets-manager"
  }
}
# terraform import google_secret_manager_secret.sta_env_auth_service projects/702081712633/secrets/sta-env-auth-service
