resource "google_compute_instance" "cfgsvr_stage_2" {
  boot_disk {
    auto_delete = true
    device_name = "cfgsvr-dev-2"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-1804-bionic-v20220616"
      size  = 20
      type  = "pd-balanced"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/cfgsvr-stage-2"
  }

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "e2-medium"

  metadata = {
    ssh-keys = "mikemwanje:ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBPFoICjDia75yOY/0+TV6pTR54vwhYZQM1U74adCTT1Poj9bdL+ioFxooRBQQ4fPdNnpoh5w0wQdqMxYJm//n6E= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-08-16T18:37:22+0000\"}\nmikemwanje:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAHtTZqjsEKvl6jBJhykyprVwavle7Azm20fc7rHyQcSwaBTRg58U2nz1cwZLyI5f72xKZ8o0+pU0oKJV0EPgz4prxqJ8T6npwhx0soh8uNAzmWFSzYN2Jx6ELneGsDuG5YJtHi4zsnopTPWSvF48lCPpDhPxb4hnVdcDGCFNW9zNsVTKqiawICDi1Kh7dVtP8+eRIrnMi2WErHGr2aWVARBQd7JLqMZU0k6xmjexs7zZJINXXAMke3pBgWlX9wZowXYgHtIL+mIJI3ZMk1pl6jPa7ubuaNKPGaVjbhEoG3RvB+smYxANVg9M/OGzDaVESt8ZITkReTO4h8Te9iWOg8k= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-08-16T18:37:38+0000\"}"
  }

  name = "cfgsvr-stage-2"

  network_interface {
    access_config {
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
    network_ip         = "10.240.0.73"
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
# terraform import google_compute_instance.cfgsvr_stage_2 projects/airqo-250220/zones/europe-west1-b/instances/cfgsvr-stage-2
