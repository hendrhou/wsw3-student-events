variable "project" {
  type    = string
  default = "campus-pulse"
}

variable "region" {
  type    = string
  default = "eu-west-1"
}

variable "db_master_password" {
  type        = string
  sensitive   = true
  description = "RDS master password. Supplied via TF_VAR_db_master_password (AWS Secrets Manager is the store of record)."
}

variable "image_tag" {
  type        = string
  default     = "latest"
  description = "Image tag the ECS services run; the release pipeline deploys pinned semver tags."
}

# Room to grow without applying: Go services stay off until their images exist.
variable "enable_backend_services" {
  type        = bool
  default     = false
  description = "Create the five Go service ECS services. Flip to true when the backend lands."
}

variable "admin_emails" {
  type        = list(string)
  default     = []
  description = "@ufp.edu.pt emails provisioned as Campus Pulse admins at user-service startup. Admins manage organisers in-app (Team screen); this list is the only way in for admins."
}
