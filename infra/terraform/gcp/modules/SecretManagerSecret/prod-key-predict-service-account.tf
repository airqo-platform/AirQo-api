resource "google_secret_manager_secret" "prod_key_predict_service_account" {
  project = "${var.project-number}"

  replication {
    automatic = true
  }

  secret_id = "prod-key-predict-service-account"
}
# terraform import google_secret_manager_secret.prod_key_predict_service_account projects/${var.project-number}/secrets/prod-key-predict-service-account
