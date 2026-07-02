# Build Phases

Each phase is independently deployable and testable before moving on.

Check tasks off as you go — this file is the tracking layer.

## Phase 0 — Scaffold & bootstrap

**Goal:** Prove the CDK → AWS pipeline works.

- [x] `mkdir infra && cd infra && cdk init app --language typescript`
- [x] Understand generated files: `bin/app.ts` (entry), `lib/*-stack.ts` (resources), `cdk.json` (config)
- [x] `cdk bootstrap` — one-time per account/region, creates S3 bucket + IAM roles CDK needs to operate
- [x] Deploy the empty stack: `cdk deploy`
- [x] Confirm in the AWS console the CloudFormation stack exists

**Concepts learned:** CloudFormation stacks, CDK project structure, bootstrapping.

---

## Phase 1 — Hello world Lambda + API Gateway

**Goal:** See the core serverless request/response loop end to end.

- [x] Add an HTTP API and a single Lambda to the CDK stack
- [x] Route: `GET /health` → Lambda returns `{ "status": "ok" }`
- [x] Deploy, hit the endpoint with `curl`
- [x] Read the CloudWatch logs

**CDK resources:** `aws_apigatewayv2.HttpApi`, `aws_lambda.Function`, `aws_apigatewayv2_integrations.HttpLambdaIntegration`

**Concepts learned:** Lambda execution model, API Gateway routes, IAM execution roles, CloudWatch logs.

---

## Phase 2 — Cognito

**Goal:** Understand auth in isolation before wiring it in.

- [x] Add a Cognito User Pool + App Client to the CDK stack
- [x] Configure email sign-up/sign-in
- [x] Sign up a test user via the AWS CLI
- [x] Exchange credentials for a JWT
- [x] Inspect the JWT (jwt.io) — understand the `sub`, `email`, `iss` claims

**CDK resources:** `aws_cognito.UserPool`, `aws_cognito.UserPoolClient`

**Concepts learned:** Cognito user pools vs identity pools, JWT structure, how claims carry user identity.

---

## Phase 3 — DynamoDB table

**Goal:** Create the data store and read/write it from a Lambda.

- [x] Define a single `Contacts` table in the CDK stack: partition key `PK` (string), sort key `SK` (string), `BillingMode.PAY_PER_REQUEST` (on-demand)
- [x] The table is schemaless and access is pure IAM — just define it and start writing
- [x] Decide the key encoding up front: `PK = USER#<sub>`, `SK = CONTACT#<id>`
- [x] Write a test Lambda that puts an item and queries it back via the DynamoDB DocumentClient
- [x] Verify: `curl /db-test` returns the item

**CDK resources:** `aws_dynamodb.Table`, Lambda IAM policy for scoped `dynamodb:*` actions on the table ARN

**Concepts learned:** partition key vs sort key, single-table mindset (access-pattern-first), on-demand vs provisioned capacity, DocumentClient, least-privilege IAM, `RemovalPolicy.DESTROY`.

---

## Phase 4 — CRUD handlers + JWT auth

**Goal:** A fully working, secured, user-scoped API.

- [x] Add JWT authorizer to API Gateway (points at Cognito user pool)
- [x] Implement Lambda handlers: `POST /contacts`, `GET /contacts`, `PUT /contacts/:id`, `DELETE /contacts/:id`
- [x] Use the caller's `sub` claim (passed by API Gateway after JWT validation) as `PK = USER#<sub>` — every read/write is confined to the caller's partition, so isolation is structural
- [x] `GET /contacts` → `Query` on the partition; single-item ops → `GetItem`/`PutItem`/`UpdateItem`/`DeleteItem` by `PK` + `SK`
- [x] Test with a real JWT: authenticated requests succeed, unauthenticated return 401

**Concepts learned:** JWT authorizer config, how `sub` as partition key scopes data per user, DynamoDB `Query` vs item operations.

---

## Phase 5 — React frontend

**Goal:** The whole thing, working in a browser.

- [ ] Scaffold React app with TanStack Router (routing) + TanStack Query (API calls)
- [ ] Integrate Cognito auth (AWS Amplify auth library or oidc-client)
- [ ] Build CRUD UI against the real API endpoints
- [ ] `npm run build` → upload to S3 → configure CloudFront distribution
- [ ] Test end to end: sign up, create a contact, read, update, delete

**CDK resources:** `aws_s3.Bucket`, `aws_cloudfront.Distribution`, `aws_cloudfront_origins.S3BucketOrigin`, `aws_s3_deployment.BucketDeployment`

**Concepts learned:** S3 static hosting, CloudFront origin access control, invalidations on deploy, `RemovalPolicy.DESTROY` on S3 bucket.
