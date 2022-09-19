resource "google_compute_disk" "pipeline_k8s_controller" {
  image                     = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-2004-focal-v20220712"
  name                      = "pipeline-k8s-controller"
  physical_block_size_bytes = 4096
  project                   = "airqo-250220"
  size                      = 50
  type                      = "pd-balanced"
  zone                      = "europe-west1-b"
}
# terraform import google_compute_disk.pipeline_k8s_controller projects/airqo-250220/zones/europe-west1-b/disks/pipeline-k8s-controller
