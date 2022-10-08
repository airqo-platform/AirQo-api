resource "google_secret_manager_secret" "prod_env_data_mgt_nodejs" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "prod-env-data-mgt-nodejs"
}
# terraform import google_secret_manager_secret.prod_env_data_mgt_nodejs projects/702081712633/secrets/prod-env-data-mgt-nodejs
