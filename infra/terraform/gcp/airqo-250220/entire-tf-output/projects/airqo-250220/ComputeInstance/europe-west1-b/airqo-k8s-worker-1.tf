resource "google_compute_instance" "airqo_k8s_worker_1" {
  boot_disk {
    auto_delete = true
    device_name = "persistent-disk-0"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-1804-bionic-v20200916"
      size  = 200
      type  = "pd-standard"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/airqo-k8s-worker-1"
  }

  can_ip_forward = true
  machine_type   = "custom-2-15360-ext"

  metadata = {
    ssh-keys = "mikemwanje:ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBABsXyrahFE/YTB8eOKbenintse7tai/kF0SqXgpfRG/vhX3Cvwopywrm63lDwc9Cx2/yrAt6GFjp7R6MsV+bUo= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-08-05T08:46:30+0000\"}\nmikemwanje:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAHJwlw+e2CLfNu9UoMoY+NmK+JBbFtQXj6R6XW+g8sTkUXEndU/qvGO/cYBSMcssTJHr+iPoFvVmBDQyB5rx1grToosw4UriStO9RNo+LfAUEMbN6BJDgOrli1zOgrDMfzP9qcj1JkQxqHuExbqM+kYBvT6x+NvX6ocAcR+cfjNgmGLPFLr/v9L7Y4c+b1IETK3H6cNUlQBzP71Xiu+UtE+i+wogojkLtXpc/WMo3+Mwwt+4uqEilM7TX8tDovkr8IttwVEfFp0IXk5Oxv6vFk4+MS5EdLjtA6wR1IMiko0kfy4UsD9PkM80e8V/sZ/y8mF3IpUTPLjNnQ5eRS/wS0c= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-08-05T08:46:45+0000\"}"
  }

  name = "airqo-k8s-worker-1"

  network_interface {
    access_config {
      nat_ip       = "34.79.18.5"
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
    network_ip         = "10.240.0.21"
    subnetwork         = "https://www.googleapis.com/compute/v1/projects/airqo-250220/regions/europe-west1/subnetworks/k8s-nodes"
    subnetwork_project = "airqo-250220"
  }

  project = "airqo-250220"

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
    provisioning_model  = "STANDARD"
  }

  service_account {
    email  = "702081712633-compute@developer.gserviceaccount.com"
    scopes = ["https://www.googleapis.com/auth/compute", "https://www.googleapis.com/auth/devstorage.read_only", "https://www.googleapis.com/auth/logging.write", "https://www.googleapis.com/auth/monitoring", "https://www.googleapis.com/auth/service.management.readonly", "https://www.googleapis.com/auth/servicecontrol"]
  }

  shielded_instance_config {
    enable_integrity_monitoring = true
    enable_vtpm                 = true
  }

  tags = ["airqo-k8s", "worker"]
  zone = "europe-west1-b"
}
# terraform import google_compute_instance.airqo_k8s_worker_1 projects/airqo-250220/zones/europe-west1-b/instances/airqo-k8s-worker-1
