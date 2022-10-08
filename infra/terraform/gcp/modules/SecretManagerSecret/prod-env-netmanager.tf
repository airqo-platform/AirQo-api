resource "google_secret_manager_secret" "prod_env_netmanager" {
  project = "${var.project-number}"

  replication {
    automatic = true
  }

  secret_id = "prod-env-netmanager"
}
# terraform import google_secret_manager_secret.prod_env_netmanager projects/${var.project-number}/secrets/prod-env-netmanager
