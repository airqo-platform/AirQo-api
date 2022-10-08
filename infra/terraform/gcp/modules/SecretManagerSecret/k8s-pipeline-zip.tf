resource "google_secret_manager_secret" "k8s_pipeline_zip" {
  project = "${var.project-number}"

  replication {
    automatic = true
  }

  secret_id = "k8s-pipeline-zip"
}
# terraform import google_secret_manager_secret.k8s_pipeline_zip projects/${var.project-number}/secrets/k8s-pipeline-zip
