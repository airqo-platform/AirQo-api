resource "google_compute_disk" "airqo_stage_haproxy" {
  image                     = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-1804-bionic-v20210720"
  name                      = "airqo-stage-haproxy"
  physical_block_size_bytes = 4096
  project                   = "airqo-250220"
  size                      = 10
  type                      = "pd-balanced"
  zone                      = "europe-west1-b"
}
# terraform import google_compute_disk.airqo_stage_haproxy projects/airqo-250220/zones/europe-west1-b/disks/airqo-stage-haproxy
