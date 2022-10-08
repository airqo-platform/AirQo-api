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

variable "os" {
  default = {
    "ubuntu-xenial" = "ubuntu-1604-xenial-v20200129"
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