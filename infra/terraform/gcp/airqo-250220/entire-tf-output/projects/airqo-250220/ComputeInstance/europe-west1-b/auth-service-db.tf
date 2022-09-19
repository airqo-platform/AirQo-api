resource "google_compute_instance" "auth_service_db" {
  boot_disk {
    auto_delete = true
    device_name = "auth-service-db"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-1804-bionic-v20210504"
      size  = 100
      type  = "pd-balanced"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/auth-service-db"
  }

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "e2-small"

  metadata = {
    ssh-keys = "mikemwanje:ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBJ5R5SxeVk8uFkk5VGBGNi9ZzDMQLkqLG719uF97T6RJmrdVIL5CRVA0Wj91Cadgig0Lt1ouxejXjQiBlYbHOHU= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-06-22T16:27:02+0000\"}\nmikemwanje:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDZDJ+O9HBw+xFNkpiGpu2mugmp9DJnyILz7TkNimPxybH7FUEfis8OBXcKIlz/fEMsFKosV0uJP3pT296TS4zkhhkB4Qf9oundr2QGBKDkBn97ruP95wqAncOMur0LHzWVV94YmE1IwCdyHdER+1oHe9C/RjGl5XTGLJ/bZUE40oOGE+ZSsyLs63DNBZoiFbCGSjIqbP1JlKxm+gk71SHCP5qXI0P9QnfWkIRCf4P8+h2pg2Hat3zwf0180N9RffvUfF5wMS/067R6MVYACx7G+7wVkviomv5gjnqqC8JiAgvGJeBt0WiDiiRah7LNnUl//ppfNE6LLmOd643BGFit google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-06-22T16:27:18+0000\"}"
  }

  name = "auth-service-db"

  network_interface {
    access_config {
      nat_ip       = "35.240.84.68"
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
    network_ip         = "10.240.0.7"
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

  tags = ["db-vm", "http-server", "https-server"]
  zone = "europe-west1-b"
}
# terraform import google_compute_instance.auth_service_db projects/airqo-250220/zones/europe-west1-b/instances/auth-service-db
