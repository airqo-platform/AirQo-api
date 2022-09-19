resource "google_compute_instance" "airqo_haproxy" {
  boot_disk {
    auto_delete = true
    device_name = "airqo-haproxy"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-1604-xenial-v20200807"
      size  = 10
      type  = "pd-standard"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/airqo-haproxy"
  }

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "g1-small"

  metadata = {
    ssh-keys = "mikemwanje:ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBNPuCOlvLN/op8ZI1qwFOt+bZm9UgjMgAxG6Nao6o0bLu63OjwSzmoW/MAPlQPgIVPucwaSHV6Rsbg8imBwfA0s= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-09-02T06:27:40+0000\"}\nmikemwanje:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDGpWRe43Dkc3fHkMK5XiDjP0hrS98n5q2CClzcMgxbdmRYbIEVfN/zkTnUfPfeK5yzXl7JXVGb34bfDd/OYCHJhKUOlVIu+DRh3IyUQWHwtaxHFjhBEmqpwT7T/HRS7//+HJUbPt7HDggHarkAe1P+4s9HGsLk5l9wbzNmDhtEUI3PzQY5Mvq0k+vzs83iqyV+Hxt+hjR0RgsSxXMSDJCiooDSKA9+g3zCQXK+nrvU/pmG0a7zwl0s0Gb5GvRXBiuIB11xn6XZywOiCR/aJYLanlqRBgwkwd0TVNwqKQYCebJxpm111Yp91QXey3k/gCypKUEVlOlaPLPGE1WPMPRv google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-09-02T06:27:55+0000\"}"
  }

  name = "airqo-haproxy"

  network_interface {
    access_config {
      nat_ip       = "35.240.91.160"
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
    network_ip         = "10.240.0.3"
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

  tags = ["http-server", "https-server"]
  zone = "europe-west1-b"
}
# terraform import google_compute_instance.airqo_haproxy projects/airqo-250220/zones/europe-west1-b/instances/airqo-haproxy
