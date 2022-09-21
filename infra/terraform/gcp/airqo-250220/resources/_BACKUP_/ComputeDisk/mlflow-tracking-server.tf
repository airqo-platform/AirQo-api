resource "google_compute_disk" "mlflow_tracking_server" {
  image                     = "https://www.googleapis.com/compute/beta/projects/cos-cloud/global/images/cos-77-12371-1109-0"
  name                      = "mlflow-tracking-server"
  physical_block_size_bytes = 4096
  project                   = "airqo-250220"
  size                      = 10
  type                      = "pd-balanced"
  zone                      = "us-central1-a"
}
# terraform import google_compute_disk.mlflow_tracking_server projects/airqo-250220/zones/us-central1-a/disks/mlflow-tracking-server
