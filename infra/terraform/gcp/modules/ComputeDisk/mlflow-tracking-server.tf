resource "google_compute_disk" "mlflow_tracking_server" {
  image                     = "https://www.googleapis.com/compute/beta/projects/cos-cloud/global/images/cos-77-12371-1109-0"
  name                      = "mlflow-tracking-server"
  physical_block_size_bytes = 4096
  project                   = var.project-id
  size      = var.disk_size["tiny"]
  type                      = "pd-balanced"
  zone                      = var.zone
}
# terraform import google_compute_disk.mlflow_tracking_server projects/${var.project-id}/zones/us-central1-a/disks/mlflow-tracking-server
