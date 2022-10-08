resource "google_secret_manager_secret" "sta_key_predict_service_account" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "sta-key-predict-service-account"
}
# terraform import google_secret_manager_secret.sta_key_predict_service_account projects/${var.project-number}/secrets/sta-key-predict-service-account
