resource "google_compute_disk" "mongo_query_router_dev" {
  image                     = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-1804-bionic-v20220616"
  name                      = "mongo-query-router-dev"
  physical_block_size_bytes = 4096
  project                   = "airqo-250220"
  size                      = 10
  type                      = "pd-balanced"
  zone                      = "europe-west1-b"
}
# terraform import google_compute_disk.mongo_query_router_dev projects/airqo-250220/zones/europe-west1-b/disks/mongo-query-router-dev
