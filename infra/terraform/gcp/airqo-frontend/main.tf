provider "google" {
  credentials = file("${path.module}/../assets/airqo-terraform.json")
  project = "airqo-frontend"
}


module "entire-tf-output-projects-airqo-frontend-IAMServiceAccount" {
  source = "./entire-tf-output/projects/airqo-frontend/IAMServiceAccount"
}


module "entire-tf-output-projects-airqo-frontend-SQLInstance-us-central1" {
  source = "./entire-tf-output/projects/airqo-frontend/SQLInstance/us-central1"
}


module "entire-tf-output-projects-airqo-frontend-PubSubTopic" {
  source = "./entire-tf-output/projects/airqo-frontend/PubSubTopic"
}


module "entire-tf-output-projects-airqo-frontend-DNSManagedZone" {
  source = "./entire-tf-output/projects/airqo-frontend/DNSManagedZone"
}


module "entire-tf-output-projects-airqo-frontend-ComputeFirewall" {
  source = "./entire-tf-output/projects/airqo-frontend/ComputeFirewall"
}


module "entire-tf-output-projects-airqo-frontend-StorageBucket-US" {
  source = "./entire-tf-output/projects/airqo-frontend/StorageBucket/US"
}


## As of Sept/2022, the provider hashicorp/google does not support resource type
## "google_logging_log_sink" on line 1 of the file a-required.tf
# module "entire-tf-output-4127550141-4127550141-Project-LoggingLogSink" {
#  source = "./entire-tf-output/4127550141/4127550141/Project/LoggingLogSink"
# }


module "entire-tf-output-4127550141-Service" {
  source = "./entire-tf-output/4127550141/Service"
}


module "entire-tf-output-projects-airqo-frontend-ComputeAddress-global" {
  source = "./entire-tf-output/projects/airqo-frontend/ComputeAddress/global"
}

