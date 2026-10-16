# Campus Pulse — production environment.
# Public surface: CloudFront (frontend from S3) + ALB /api/* → Kong.
# Everything else is private. See infra/README.md for the bootstrap order.

locals {
  ecr_repos = ["shell", "student-mfe", "organiser-mfe", "kong", "user-service", "event-service", "registration-service", "semantic-service", "ticket-service"]
}

module "vpc" {
  source  = "../../modules/vpc"
  project = var.project
}

module "ecr" {
  source       = "../../modules/ecr"
  project      = var.project
  repositories = local.ecr_repos
}

module "rds" {
  source             = "../../modules/rds"
  project            = var.project
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  allowed_sg_ids     = concat([module.kong.security_group_id], aws_security_group.services[*].id)
  master_password    = var.db_master_password
}

module "alb" {
  source            = "../../modules/alb"
  project           = var.project
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
}

module "frontend" {
  source            = "../../modules/frontend"
  project           = var.project
  api_origin_domain = module.alb.dns_name
}

# ---------- ECS cluster + internal discovery ----------
resource "aws_ecs_cluster" "this" {
  name = var.project
}

resource "aws_service_discovery_private_dns_namespace" "internal" {
  name = "${var.project}.internal"
  vpc  = module.vpc.vpc_id
}

# Shared SG for the Go services (they only accept traffic from Kong)
resource "aws_security_group" "services" {
  count  = var.enable_backend_services ? 1 : 0
  name   = "${var.project}-services"
  vpc_id = module.vpc.vpc_id
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ---------- Secrets (values are set manually once; tasks read them at boot) ----------
resource "aws_secretsmanager_secret" "jwt" {
  name = "${var.project}/jwt-secret"
}
resource "aws_secretsmanager_secret" "google_oauth" {
  name = "${var.project}/google-oauth" # JSON: {"client_id":"…","client_secret":"…"}
}
resource "aws_secretsmanager_secret" "db_master" {
  name = "${var.project}/db-master-password"
}

# ---------- Kong (only service attached to the ALB) ----------
module "kong" {
  source                 = "../../modules/ecs-service"
  project                = var.project
  name                   = "kong"
  image                  = "${module.ecr.repository_urls["kong"]}:${var.image_tag}"
  port                   = 8000
  cpu                    = 512
  memory                 = 1024
  cluster_id             = aws_ecs_cluster.this.id
  vpc_id                 = module.vpc.vpc_id
  private_subnet_ids     = module.vpc.private_subnet_ids
  region                 = var.region
  target_group_arn       = module.alb.kong_target_group_arn
  allowed_ingress_sg_ids = [module.alb.security_group_id]
  environment = {
    KONG_DATABASE           = "off"
    KONG_DECLARATIVE_CONFIG = "/kong/kong.yml"
    KONG_PROXY_LISTEN       = "0.0.0.0:8000"
  }
  # NOTE: kong.yml baked into the image; upstreams resolve via the
  # service-discovery namespace (user-service.campus-pulse.internal, …).
}

# ---------- Fuseki (semantic layer store) ----------
module "fuseki" {
  source                 = "../../modules/ecs-service"
  project                = var.project
  name                   = "fuseki"
  image                  = "stain/jena-fuseki:5.1.0"
  port                   = 3030
  cluster_id             = aws_ecs_cluster.this.id
  vpc_id                 = module.vpc.vpc_id
  private_subnet_ids     = module.vpc.private_subnet_ids
  region                 = var.region
  discovery_namespace_id = aws_service_discovery_private_dns_namespace.internal.id
  allowed_ingress_sg_ids = aws_security_group.services[*].id
  environment = {
    ADMIN_PASSWORD = "change-me-via-secrets" # move to Secrets Manager before real data
  }
}

# ---------- Go services (room to grow; off until images exist) ----------
module "go_service" {
  for_each = var.enable_backend_services ? toset(["user-service", "event-service", "registration-service", "semantic-service", "ticket-service"]) : toset([])
  source   = "../../modules/ecs-service"

  project                = var.project
  name                   = each.value
  image                  = "${module.ecr.repository_urls[each.value]}:${var.image_tag}"
  port                   = 8080
  cluster_id             = aws_ecs_cluster.this.id
  vpc_id                 = module.vpc.vpc_id
  private_subnet_ids     = module.vpc.private_subnet_ids
  region                 = var.region
  discovery_namespace_id = aws_service_discovery_private_dns_namespace.internal.id
  allowed_ingress_sg_ids = [module.kong.security_group_id]
  environment = merge(
    { PORT = "8080" },
    # Per-service extras. user-service owns identity: ADMIN_EMAILS provisions
    # the in-app admins (they sign in with Google like everyone else).
    each.value == "user-service" && length(var.admin_emails) > 0 ? {
      ADMIN_EMAILS = join(",", var.admin_emails)
    } : {},
  )
  secrets = {
    JWT_SECRET = aws_secretsmanager_secret.jwt.arn
  }
}
