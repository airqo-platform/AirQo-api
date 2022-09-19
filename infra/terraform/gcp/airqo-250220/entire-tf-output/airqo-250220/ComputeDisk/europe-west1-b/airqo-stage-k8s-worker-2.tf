resource "google_compute_disk" "airqo_stage_k8s_worker_2" {
  image                     = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-2004-focal-v20220712"
  name                      = "airqo-stage-k8s-worker-2"
  physical_block_size_bytes = 4096
  project                   = "airqo-250220"
  size                      = 100
  type                      = "pd-standard"
  zone                      = "europe-west1-b"
}
# terraform import google_compute_disk.airqo_stage_k8s_worker_2 projects/airqo-250220/zones/europe-west1-b/disks/airqo-stage-k8s-worker-2
