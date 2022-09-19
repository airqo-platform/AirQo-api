resource "google_compute_instance" "cfgsvr_dev_1" {
  boot_disk {
    auto_delete = true
    device_name = "cfgsvr-dev-3"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-1804-bionic-v20220616"
      size  = 50
      type  = "pd-balanced"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/cfgsvr-dev-1"
  }

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "e2-medium"

  metadata = {
    ssh-keys = "mikemwanje:ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBF5aEhLJZfp1ulNn4YquW9YxzHkFajuDOq0kw6OXIxNtUm+J/0UWPCNPUEEOy7acQMwsQla/y/fiZhgGX7Zd+Lk= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-09-12T13:56:51+0000\"}\nmikemwanje:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCdj2BBYU1ssnSNh4Qbb9BC7TvEt918rqOHf5LLR/37dR3Gd2fHaalJ73KClwrMVizAFoLbwSrO/vqwjmFrq9XXxWI2zC3cicHddXnUHU17GFjcjvxw5AkVNmtRUL7FDIfm1MBGVM7i6ms0TLuBpwyX9m8Y4Dq83GYGm8BtT77Ol0UcauHIuQJZn9/dGAkiRP9J2GLKMXMujG0byCfzrPmNXFZauK3upHNeIUHkknT/vQs80zMr7wql4EzbbjFOt7D7fpyU85rqKEMl3r+W3qlAy1B8GYhcklh998sIRLQonhcsgUZmdZTc7FnlLpB7g5+wGx1YVIq5qVIlsXMXXI17 google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-09-12T13:57:07+0000\"}"
  }

  name = "cfgsvr-dev-1"

  network_interface {
    access_config {
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
    network_ip         = "10.240.0.60"
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
# terraform import google_compute_instance.cfgsvr_dev_1 projects/airqo-250220/zones/europe-west1-b/instances/cfgsvr-dev-1
