resource "google_compute_instance" "mongo_query_router_prod" {
  boot_disk {
    auto_delete = true
    device_name = "mongo-query-router-dev"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-1804-bionic-v20220616"
      size  = 10
      type  = "pd-balanced"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/mongo-query-router-prod"
  }

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "e2-micro"

  metadata = {
    ssh-keys = "mikemwanje:ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEX6N3Jf48eh+jkgyJMktKNjEPYtuzXu0EG81I0vGnS5xdBy7mZsehhjGmzTEaCmL1M5WQCS8oSOWBtEiT101Rc= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-09-12T15:37:36+0000\"}\nmikemwanje:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCOO0sBtWn5Wbbe8fFlGlpoqNVrS/UUU2nYI+PMguWDV0iCsOTPpJMG3tYnkWkH79KcXc5CnXWr+3lfZlxauKg5vgv1vcw7X8L9M7zWp08geF39n/Zan7Jv8Bo62miCjEax0xaGpjSoUgw3WG5768uvM8sn0AMUGqglDxJeEjjzxJ3li0e6ChmF+7s0VHS8hSirTjfa+4fYwTgjt1nbrWl9WlHsQgw/1KzcWdsQCo3a/ICBxAF7bszHlGVdTcOls1Yo9r/y9SQ1qfGIIOYPLgHFRukK2pP3372yNd3JTICuN82j7zqIEmJPOyB7wfLKcr/Ro2YScD1sC0KDoXfldLjB google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-09-12T15:37:52+0000\"}"
  }

  name = "mongo-query-router-prod"

  network_interface {
    access_config {
      nat_ip       = "35.205.222.241"
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
    network_ip         = "10.240.0.84"
    stack_type         = "IPV4_ONLY"
    subnetwork         = "https://www.googleapis.com/compute/v1/projects/airqo-250220/regions/europe-west1/subnetworks/k8s-nodes"
    subnetwork_project = "airqo-250220"
  }

  project = "airqo-250220"

  reservation_affinity {
    type = "ANY_RESERVATION"
  }

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
    provisioning_model  = "STANDARD"
  }

  service_account {
    email  = "702081712633-compute@developer.gserviceaccount.com"
    scopes = ["https://www.googleapis.com/auth/devstorage.read_only", "https://www.googleapis.com/auth/logging.write", "https://www.googleapis.com/auth/monitoring.write", "https://www.googleapis.com/auth/service.management.readonly", "https://www.googleapis.com/auth/servicecontrol", "https://www.googleapis.com/auth/trace.append"]
  }

  shielded_instance_config {
    enable_integrity_monitoring = true
    enable_vtpm                 = true
  }

  tags = ["airqo-shard", "http-server", "https-server"]
  zone = "europe-west1-b"
}
# terraform import google_compute_instance.mongo_query_router_prod projects/airqo-250220/zones/europe-west1-b/instances/mongo-query-router-prod
