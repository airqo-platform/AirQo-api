resource "google_secret_manager_secret" "prod_env_gp_model" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "prod-env-gp-model"
}
# terraform import google_secret_manager_secret.prod_env_gp_model projects/702081712633/secrets/prod-env-gp-model
