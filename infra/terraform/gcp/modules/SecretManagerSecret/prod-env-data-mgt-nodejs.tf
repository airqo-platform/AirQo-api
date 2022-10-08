resource "google_secret_manager_secret" "prod_env_data_mgt_nodejs" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "prod-env-data-mgt-nodejs"
}
# terraform import google_secret_manager_secret.prod_env_data_mgt_nodejs projects/${var.project-number}/secrets/prod-env-data-mgt-nodejs
