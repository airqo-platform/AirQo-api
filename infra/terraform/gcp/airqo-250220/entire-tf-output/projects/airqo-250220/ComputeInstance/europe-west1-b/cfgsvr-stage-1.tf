resource "google_compute_instance" "cfgsvr_stage_1" {
  boot_disk {
    auto_delete = true
    device_name = "cfgsvr-dev-2"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-1804-bionic-v20220616"
      size  = 20
      type  = "pd-balanced"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/cfgsvr-stage-1"
  }

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "e2-medium"

  metadata = {
    ssh-keys = "mikemwanje:ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBNgRimRgnsT6wljS9FV0SuhP7h4AfsRXEafDkUztZuVKBYyC6KRorF39DUa6pb0ry5tYYpTVVNhWUkXzC+ujGkM= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-08-16T18:33:54+0000\"}\nmikemwanje:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAHSzjCyyRu8rTmBz+x50tjQX1lnkmcm3RWoR59vJn5waCVXC/CryyJLOkZJRX7XKhcrtTtTKrxywPVPcsmEoEGJO2VNJointKZvDNacfyuyHKj06WLJeqMQZNa4+GV7QQTggrCAz4E1ZKwvF+E98KPdJNLXlDl8qy60J4OcmYAkqzUmQ6rfd3bOvyJJJaZjMOW7CcqUeBEMvCcwEcGA8ygrvGu8AVRrch11gs5RavseJ3BQCIHCBdhvqpR2knlvsXLLE1Ykcju9h4cCE0SbL50fN+OzlgYJTCD/UnfTAy/EUNrhzITsqOt5JnfCj6a9R7wrPJnbZuDT1VFeGyPL3ie8= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-08-16T18:34:11+0000\"}"
  }

  name = "cfgsvr-stage-1"

  network_interface {
    access_config {
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
    network_ip         = "10.240.0.71"
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
# terraform import google_compute_instance.cfgsvr_stage_1 projects/airqo-250220/zones/europe-west1-b/instances/cfgsvr-stage-1
