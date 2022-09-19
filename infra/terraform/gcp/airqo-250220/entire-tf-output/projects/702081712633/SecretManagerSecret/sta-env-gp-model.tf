resource "google_secret_manager_secret" "sta_env_gp_model" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "sta-env-gp-model"
}
# terraform import google_secret_manager_secret.sta_env_gp_model projects/702081712633/secrets/sta-env-gp-model
