# Campus Pulse — Infrastructure (AWS, Terraform)

Terraform for the AWS deployment. **Nothing here has been applied** — the code
is reviewable infrastructure-as-intent until the first manual apply.

## Target topology

```
browser
  └── CloudFront ──► S3 (shell + MFE bundles; only public surface)
        └── /api/* ──► public ALB ──► Kong (Fargate, private subnets)
                                        ├── user-service ─┐
                                        ├── event-service ─┤
                                        ├── registration-service ─┼─► RDS PostgreSQL
                                        ├── ticket-service ─┤    (1 instance,
                                        └── semantic-service ─┘    1 db per service)
                                        └── semantic-service ──► Fuseki (Fargate + EFS)
```

- **Only the frontend is public.** CloudFront serves the S3 bundles; `/api/*`
  is proxied to the ALB→Kong path. All ECS tasks and RDS live in private
  subnets with chained security groups (ALB→Kong→services→RDS).
- **Images** live in ECR (one repo per deployable); releases are pushed as
  immutable semver tags by `.github/workflows/release.yml`.
- **Secrets** live in AWS Secrets Manager (`campus-pulse/jwt-secret`,
  `campus-pulse/google-oauth`, `campus-pulse/db-master-password`); ECS task
  definitions read them at container start. GitHub Actions assumes an OIDC
  role — no AWS keys are stored anywhere.
- **Fuseki** persists triples on EFS across task restarts.

## Bootstrap order (when the time comes — not before)

1. **State backend** (one-time, manual): create an S3 bucket + DynamoDB lock
   table, then uncomment `envs/prod/backend.tf` and `terraform init -migrate-state`.
2. `terraform apply` (via the `terraform-apply.yml` workflow, manual dispatch +
   production approval) with `enable_backend_services=false` — creates network,
   ECR, RDS, ALB, CloudFront, Kong, Fuseki.
3. Create the per-service databases on RDS (one-off):
   `psql` from a bastion/CloudShell → `CREATE DATABASE users; CREATE DATABASE events;
   CREATE DATABASE registrations; CREATE DATABASE tickets;` (+ per-service roles).
4. Set secret values in Secrets Manager (console or CLI).
5. Merge backend PRs → the release pipeline pushes images → flip
   `enable_backend_services=true` → apply again.

## Layout

```
infra/terraform/
├── modules/
│   ├── vpc/           2 AZs, public+private subnets, single NAT
│   ├── ecr/           one repo per image, lifecycle keeps 20
│   ├── rds/           one PostgreSQL 16 instance, private, per-service DBs
│   ├── frontend/      S3 (OAC, private) + CloudFront with /api/* → ALB behavior
│   ├── alb/           public ALB, /api/* → Kong target group, 404 default
│   └── ecs-service/   reusable Fargate service (env + secrets, Cloud Map, logs)
└── envs/prod/         the environment wiring the modules
```

## Local validation (no AWS account needed)

```sh
cd infra/terraform/envs/prod
terraform fmt -recursive
terraform init -backend=false
terraform validate
```

PRs touching `infra/terraform/**` get a self-updating plan comment via
`terraform-plan.yml`. Applies only ever happen through `terraform-apply.yml`
(manual dispatch, `production` environment approval).
