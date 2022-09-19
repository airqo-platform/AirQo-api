resource "google_compute_instance" "mongo_query_router_stage" {
  boot_disk {
    auto_delete = true
    device_name = "mongo-query-router-dev"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-1804-bionic-v20220616"
      size  = 10
      type  = "pd-balanced"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/mongo-query-router-stage"
  }

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "e2-micro"

  metadata = {
    ssh-keys = "mikemwanje:ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBDyLtE1jop1BLBo6VO0H2vgA/iEnnsmSk/8cvIohl6xWTpJqWFriaYfdve5eHIoHob65mu+8/4YFbDVu0eiTkEQ= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-08-24T14:29:07+0000\"}\nmikemwanje:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCAzTFTzmeZkya4/1ZBlun6rd5zsxacWfZLbr4npkc3ZHoGPCWcsQJqCC8jC68wZpMjA0AFMajZnIv/UxA2/ihBf9KxMN5uZdMeFqAK5cLXlRpY0e68A+sGBnDisAIkN1MeiC0W7ORXftbWTybd2f42ELNjzcnxh2F0d8/kX196TBQYCVGU2wg8pcPtchH9hWpCQKEl0EyJDfCaJvuKM/KjcMo+kIO5dmXEARA3WaVFYdUTTjj9QbSLo2/lRqTDRcljHDX3TQI16v4FeGR1EDoJ1Wzvkdp28hzrXWCe0Oi7zH50o41Loul52fAZhCaDvkplyrMeF6BM1ZfqziK9gjvz google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-08-24T14:29:23+0000\"}"
  }

  name = "mongo-query-router-stage"

  network_interface {
    access_config {
      nat_ip       = "34.78.241.124"
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
    network_ip         = "10.240.0.72"
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
# terraform import google_compute_instance.mongo_query_router_stage projects/airqo-250220/zones/europe-west1-b/instances/mongo-query-router-stage
