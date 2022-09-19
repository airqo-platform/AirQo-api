resource "google_compute_disk" "cfgsvr_stage_2" {
  image                     = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-1804-bionic-v20220616"
  name                      = "cfgsvr-stage-2"
  physical_block_size_bytes = 4096
  project                   = "airqo-250220"
  size                      = 20
  type                      = "pd-balanced"
  zone                      = "europe-west1-b"
}
# terraform import google_compute_disk.cfgsvr_stage_2 projects/airqo-250220/zones/europe-west1-b/disks/cfgsvr-stage-2
