resource "google_secret_manager_secret" "sta_env_exceedances" {
  project = "702081712633"

  replication {
    automatic = true
  }

  rotation {
    next_rotation_time = "2022-09-27T21:00:00Z"
    rotation_period    = "2592000s"
  }

  secret_id = "sta-env-exceedances"

  topics {
    name = "projects/airqo-250220/topics/secrets-manager"
  }
}
# terraform import google_secret_manager_secret.sta_env_exceedances projects/702081712633/secrets/sta-env-exceedances
