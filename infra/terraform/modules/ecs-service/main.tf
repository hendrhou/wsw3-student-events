# Reusable Fargate service: task definition (env + Secrets Manager wiring),
# service in private subnets, Cloud Map registration for internal discovery,
# its own security group and log group.

variable "project" { type = string }
variable "name" { type = string }
variable "image" { type = string }
variable "port" { type = number }
variable "cpu" {
  type    = number
  default = 256
}
variable "memory" {
  type    = number
  default = 512
}
variable "desired_count" {
  type    = number
  default = 1
}
variable "cluster_id" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "environment" {
  type    = map(string)
  default = {}
}
variable "secrets" {
  type      = map(string) # env var name → Secrets Manager secret ARN
  default   = {}
  sensitive = true
}
variable "target_group_arn" {
  type    = string
  default = null
}
variable "discovery_namespace_id" {
  type    = string
  default = null
}
variable "allowed_ingress_sg_ids" {
  type    = list(string)
  default = []
}
variable "region" { type = string }

resource "aws_cloudwatch_log_group" "this" {
  name              = "/ecs/${var.project}/${var.name}"
  retention_in_days = 14
}

resource "aws_security_group" "this" {
  name   = "${var.project}-${var.name}"
  vpc_id = var.vpc_id
  dynamic "ingress" {
    for_each = toset(var.allowed_ingress_sg_ids)
    content {
      from_port       = var.port
      to_port         = var.port
      protocol        = "tcp"
      security_groups = [ingress.value]
    }
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

data "aws_iam_policy_document" "task_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${var.project}-${var.name}-execution"
  assume_role_policy = data.aws_iam_policy_document.task_assume.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "read_secrets" {
  count = length(var.secrets) > 0 ? 1 : 0
  name  = "read-secrets"
  role  = aws_iam_role.execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = values(var.secrets)
    }]
  })
}

resource "aws_ecs_task_definition" "this" {
  family                   = "${var.project}-${var.name}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.execution.arn

  container_definitions = jsonencode([{
    name      = var.name
    image     = var.image
    essential = true
    portMappings = [{
      containerPort = var.port
      protocol      = "tcp"
    }]
    environment = [for k, v in var.environment : { name = k, value = v }]
    secrets     = [for k, arn in var.secrets : { name = k, valueFrom = arn }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.this.name
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = var.name
      }
    }
  }])
}

resource "aws_service_discovery_service" "this" {
  count = var.discovery_namespace_id != null ? 1 : 0
  name  = var.name
  dns_config {
    namespace_id = var.discovery_namespace_id
    dns_records {
      type = "A"
      ttl  = 10
    }
  }
  health_check_custom_config { failure_threshold = 1 }
}

resource "aws_ecs_service" "this" {
  name            = "${var.project}-${var.name}"
  cluster         = var.cluster_id
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.this.id]
    assign_public_ip = false
  }

  dynamic "load_balancer" {
    for_each = var.target_group_arn != null ? [1] : []
    content {
      target_group_arn = var.target_group_arn
      container_name   = var.name
      container_port   = var.port
    }
  }

  dynamic "service_registries" {
    for_each = var.discovery_namespace_id != null ? [1] : []
    content {
      registry_arn = aws_service_discovery_service.this[0].arn
    }
  }

  lifecycle {
    ignore_changes = [desired_count]
  }
}

output "security_group_id" { value = aws_security_group.this.id }
output "service_name" { value = aws_ecs_service.this.name }
