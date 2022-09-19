resource "google_secret_manager_secret" "prod_env_calibrate_app" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "prod-env-calibrate-app"
}
# terraform import google_secret_manager_secret.prod_env_calibrate_app projects/702081712633/secrets/prod-env-calibrate-app
