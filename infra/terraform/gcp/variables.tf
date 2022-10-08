variable "project-id" {
  default = "airqo-250220"
}

variable "project-number" {
  default = "702081712633"
}

variable "region" {
  default = "europe-west1"
}

variable "zone" {
  default = "europe-west1-b"
}

variable "location" {
  default = "EU"
}

variable "os" {
  default = {
    "ubuntu-xenial" = var.os["ubuntu-xenial"]
    "ubuntu-bionic" = "ubuntu-1804-bionic"
    "ubuntu-focal" = "ubuntu-2004-focal-v20220712"
  }
}

variable "disk_size" {
  default = {
    "tiny"   = "10"
    "small"  = "20"
    "medium" = "100"
    "large"  = "200"
  }
}