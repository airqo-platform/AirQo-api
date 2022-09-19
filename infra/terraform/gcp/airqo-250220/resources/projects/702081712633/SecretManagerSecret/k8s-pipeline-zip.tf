resource "google_secret_manager_secret" "k8s_pipeline_zip" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "k8s-pipeline-zip"
}
# terraform import google_secret_manager_secret.k8s_pipeline_zip projects/702081712633/secrets/k8s-pipeline-zip
