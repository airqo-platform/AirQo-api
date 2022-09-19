resource "google_compute_instance" "airqo_stage_haproxy" {
  boot_disk {
    auto_delete = true
    device_name = "airqo-stage-haproxy"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-1804-bionic-v20210720"
      size  = 10
      type  = "pd-balanced"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/airqo-stage-haproxy"
  }

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "e2-small"

  metadata = {
    ssh-keys = "mikemwanje:ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBL/CSyZd2Z5sRjafwv4grGwuJBriJS+tLG4gpT1OQdLWh/3r0EeN9w/j7dniIJ1VZIZzApvFYFzuXkG4+91vSl0= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-09-07T08:55:24+0000\"}\nmikemwanje:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCdBGPjWE9Eg12R8j9UHkknuWIS2vLWIQQXQQxoyhZx1z9vpo9uh6J0Z7iH9bGPnqG7r6jW+WprldHez9y+iS8y51XrhawPv0McpepFKV0wEWtX6bHrsMsRV0XxD0ZcCjchyujItYiinOwLLku1fBWS6l2wP6TJ53DMSiTjnLpxR9RZxLhPrh2E1cAMyYW1p0ibcraXcEZdSA63S0mbHghjvRC+FuSy0WF9gLu8LJR8jhFYrDSWlHZs7/CMr0XSi1Q9f8jyOJhBgIvUNnR2APFSE7X97xrRvP+3FmjeTUFzasH+G7IUoTD8ypWZkcY84Iym0s6QYGxMESTvgkpP/K5d google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-09-07T08:55:40+0000\"}"
  }

  name = "airqo-stage-haproxy"

  network_interface {
    access_config {
      nat_ip       = "35.195.26.191"
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
    network_ip         = "10.240.0.103"
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

  tags = ["haproxy", "http-server", "https-server"]
  zone = "europe-west1-b"
}
# terraform import google_compute_instance.airqo_stage_haproxy projects/airqo-250220/zones/europe-west1-b/instances/airqo-stage-haproxy
