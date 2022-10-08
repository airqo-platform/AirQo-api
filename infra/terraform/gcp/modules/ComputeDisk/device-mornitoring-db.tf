resource "google_compute_disk" "device_mornitoring_db" {
  image                     = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-1804-bionic-v20210514"
  name                      = "device-mornitoring-db"
  physical_block_size_bytes = 4096
  project                   = "${var.project-id}"
  size                      = 250
  type                      = "pd-balanced"
  zone                      = "europe-west1-b"
}
# terraform import google_compute_disk.device_mornitoring_db projects/airqo-250220/zones/europe-west1-b/disks/device-mornitoring-db
