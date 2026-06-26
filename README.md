# Contactly — AWS Learning Plan

**Contactly** is a simple contacts app (CRUD + email auth) built as a deliberate first step into the AWS serverless ecosystem.

The goal is to internalize the "AWS way" of building things — infra-as-code, managed auth, serverless compute, cloud-native databases — before tackling more complex projects. Every decision in this project prioritizes learning the core AWS mental model over feature completeness: one resource at a time, deployed and understood before moving to the next.

---

## The Stack

| Layer | Choice | Role |
|---|---|---|
| Infra | CDK (TypeScript) | Defines every resource as code, `cdk deploy` / `cdk destroy` |
| Frontend | React + TanStack | The UI, built to static files |
| Hosting | S3 + CloudFront | Serves the React build, single entry point |
| API | API Gateway (HTTP API) | HTTP routes, validates Cognito JWTs natively |
| Auth | Cognito | Email sign-up/sign-in, issues JWTs |
| Compute | Lambda (Node.js) | CRUD business logic, scoped per user |
| Database | DynamoDB (on-demand) | Stores contacts, pay-per-request, scales to zero at idle, pure IAM access |

---

## Architecture

![Contactly Architecture](docs/assets/architecture.png)

### Key architectural decisions

**DynamoDB as the data store**
Fully serverless and fully managed: access is a plain AWS SDK call authorized by IAM. The design discipline is access-pattern-first — list the queries the app makes, then shape the keys so each is answered by a single request. Contactly's patterns are simple (list a user's contacts, get/update/delete one), so a single table fits cleanly.

**One Contacts table, Cognito `sub` as the partition key**
Every contact lives under `PK = USER#<sub>`, so listing a user's contacts is one query against their partition and user isolation is structural — there's no `WHERE user_id =` to forget. No separate users table: Cognito is the user store (the JWT already carries `sub`, `email`). Full single-table design (multiple entity types sharing one table) would be overkill for a single relationship, so it's intentionally out of scope here.

**HTTP API (API Gateway v2) over REST API (v1)**
HTTP API has a native JWT authorizer — API Gateway validates Cognito tokens automatically with zero custom code. Cheaper and simpler than a Lambda authorizer.

**CDK (TypeScript) over SAM / console**
Infra as real code — loops, functions, shared types with Lambda handlers. One `cdk deploy` to create everything, one `cdk destroy` to tear it down cleanly. `RemovalPolicy.DESTROY` on all resources for clean teardown.

---

## Project Structure

```
contactly/
  infra/
    bin/
      app.ts               # CDK entry point
    lib/
      contactly-stack.ts   # All AWS resources defined here
    cdk.json
    tsconfig.json

  packages/
    api/
      src/
        handlers/
          contacts.ts      # CRUD Lambda handler
        db/
          client.ts        # DynamoDB DocumentClient helper
        types/
          index.ts         # Shared types

    web/
      src/                 # React + TanStack app

  package.json             # Monorepo root
  tsconfig.json
```

---

## Build Phases

Each phase is independently deployable and testable before moving on.

### Phase 0 — Scaffold & bootstrap

**Goal:** Prove the CDK → AWS pipeline works.

- `mkdir infra && cd infra && cdk init app --language typescript`
- Understand generated files: `bin/app.ts` (entry), `lib/*-stack.ts` (resources), `cdk.json` (config)
- `cdk bootstrap` — one-time per account/region, creates S3 bucket + IAM roles CDK needs to operate
- Deploy the empty stack: `cdk deploy`
- Confirm in the AWS console the CloudFormation stack exists

**Concepts learned:** CloudFormation stacks, CDK project structure, bootstrapping.

---

### Phase 1 — Hello world Lambda + API Gateway

**Goal:** See the core serverless request/response loop end to end.

- Add an HTTP API and a single Lambda to the CDK stack
- Route: `GET /health` → Lambda returns `{ "status": "ok" }`
- Deploy, hit the endpoint with `curl`
- Read the CloudWatch logs

**CDK resources:** `aws_apigatewayv2.HttpApi`, `aws_lambda.Function`, `aws_apigatewayv2_integrations.HttpLambdaIntegration`

**Concepts learned:** Lambda execution model, API Gateway routes, IAM execution roles, CloudWatch logs.

---

### Phase 2 — Cognito

**Goal:** Understand auth in isolation before wiring it in.

- Add a Cognito User Pool + App Client to the CDK stack
- Configure email sign-up/sign-in
- Sign up a test user via the AWS CLI
- Exchange credentials for a JWT
- Inspect the JWT (jwt.io) — understand the `sub`, `email`, `iss` claims

**CDK resources:** `aws_cognito.UserPool`, `aws_cognito.UserPoolClient`

**Concepts learned:** Cognito user pools vs identity pools, JWT structure, how claims carry user identity.

---

### Phase 3 — DynamoDB table

**Goal:** Create the data store and read/write it from a Lambda.

- Define a single `Contacts` table in the CDK stack: partition key `PK` (string), sort key `SK` (string), `BillingMode.PAY_PER_REQUEST` (on-demand)
- The table is schemaless and access is pure IAM — just define it and start writing
- Decide the key encoding up front: `PK = USER#<sub>`, `SK = CONTACT#<id>`
- Write a test Lambda that puts an item and queries it back via the DynamoDB DocumentClient
- Verify: `curl /db-test` returns the item

**CDK resources:** `aws_dynamodb.Table`, Lambda IAM policy for scoped `dynamodb:*` actions on the table ARN

**Concepts learned:** partition key vs sort key, single-table mindset (access-pattern-first), on-demand vs provisioned capacity, DocumentClient, least-privilege IAM, `RemovalPolicy.DESTROY`.

---

### Phase 4 — CRUD handlers + JWT auth

**Goal:** A fully working, secured, user-scoped API.

- Add JWT authorizer to API Gateway (points at Cognito user pool)
- Implement Lambda handlers: `POST /contacts`, `GET /contacts`, `PUT /contacts/:id`, `DELETE /contacts/:id`
- Use the caller's `sub` claim (passed by API Gateway after JWT validation) as `PK = USER#<sub>` — every read/write is confined to the caller's partition, so isolation is structural
- `GET /contacts` → `Query` on the partition; single-item ops → `GetItem`/`PutItem`/`UpdateItem`/`DeleteItem` by `PK` + `SK`
- Test with a real JWT: authenticated requests succeed, unauthenticated return 401

**Concepts learned:** JWT authorizer config, how `sub` as partition key scopes data per user, DynamoDB `Query` vs item operations.

---

### Phase 5 — React frontend

**Goal:** The whole thing, working in a browser.

- Scaffold React app with TanStack Router (routing) + TanStack Query (API calls)
- Integrate Cognito auth (AWS Amplify auth library or oidc-client)
- Build CRUD UI against the real API endpoints
- `npm run build` → upload to S3 → configure CloudFront distribution
- Test end to end: sign up, create a contact, read, update, delete

**CDK resources:** `aws_s3.Bucket`, `aws_cloudfront.Distribution`, `aws_cloudfront_origins.S3BucketOrigin`, `aws_s3_deployment.BucketDeployment`

**Concepts learned:** S3 static hosting, CloudFront origin access control, invalidations on deploy, `RemovalPolicy.DESTROY` on S3 bucket.

---

## Engineering Principles

- **Infra-as-code only** — no resources created manually in the console
- **Least-privilege IAM** — every Lambda gets only the permissions it needs, scoped to specific ARNs (here: `dynamodb:*` on the Contacts table ARN, nothing wider)
- **No long-lived credentials** — services authenticate via IAM roles, never plaintext secrets or env-var credentials (DynamoDB needs none)
- **`RemovalPolicy.DESTROY` on all resources** — `cdk destroy` must work cleanly every time
- **One phase at a time** — deploy and validate before adding the next layer
- **Read CloudWatch logs** — every time something breaks, logs first
