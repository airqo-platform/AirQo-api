resource "google_compute_instance" "mongo_query_router_dev" {
  boot_disk {
    auto_delete = true
    device_name = "mongo-query-router-dev"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-1804-bionic-v20220616"
      size  = 10
      type  = "pd-balanced"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/mongo-query-router-dev"
  }

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "e2-medium"

  metadata = {
    ssh-keys = "mikemwanje:ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBHiJnFyQNvo0iSdynoif4RYu+nr83ROUTf05vD4hunZKHHUENN8H9SWvsjttQR2giK8eyhSA7pOJVzwb2gxyiPQ= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-09-12T13:56:43+0000\"}\nmikemwanje:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCWG3YJYmKoYp0VnQ0X16Ptu8OUkbFFrEQHb+3j6MwuPdaIjPg/IaoZD/TlUBUPKIu8vvdtYGEv9e7KAebuRYOSkN8oUmgAwPP4Dv7xwZTNPWhv0gmt4GO0/YpPtqkZEEzQSSvAVc55HMmqLy9dFWCsuGRvAcOX+CZJZiCXAFpo1gwdeBdLbfQ3rLYCgc8dTGxfqzz70FTQzUphBC2tB5t7Gmtj/BEoYBFyIHaub/6tuLDPn84/M5Rh/JJ3pdgwt9+JdCAVff83hbau7rmeRZ24qHsOeUZznTGNiDQiBNDq76dpX3QmqlisfnuBRbChbKOgjZmEXvwRaM7/NqJLMMnh google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-09-12T13:56:58+0000\"}"
  }

  name = "mongo-query-router-dev"

  network_interface {
    access_config {
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
    network_ip         = "10.240.0.64"
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
# terraform import google_compute_instance.mongo_query_router_dev projects/airqo-250220/zones/europe-west1-b/instances/mongo-query-router-dev
