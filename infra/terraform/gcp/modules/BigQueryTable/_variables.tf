variable "project-id" {
  type = string
  description = "Project ID"
}

variable "project-number" {
  type = string
  description = "Project number"
}

variable "region" {
  type = string
  description = "Default region"
}

variable "zone" {
  type = string
  description = "Default zone"
}

variable "location" {
  type = string
  description = "Default location"
}

variable "os" {
  type = map
  description = "Default operating systems"
}

variable "disk_size" {
  type = map
  description = "Default disk sizes"
}