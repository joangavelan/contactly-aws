import * as path from "node:path"
import { HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2"
import { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers"
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations"
import { AccountRecovery, UserPool, UserPoolClient } from "aws-cdk-lib/aws-cognito"
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb"
import { Runtime } from "aws-cdk-lib/aws-lambda"
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs"
import * as cdk from "aws-cdk-lib/core"
import { RemovalPolicy } from "aws-cdk-lib/core"
import type { Construct } from "constructs"

export class ContactlyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // Cognito User Pool
    const userPool = new UserPool(this, "UserPool", {
      userPoolName: "contactly-users",
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    // User Pool Client (the "app" that authenticates against the pool)
    const userPoolClient = new UserPoolClient(this, "UserPoolClient", {
      userPool,
      userPoolClientName: "contactly-cli",
      generateSecret: false,
      authFlows: {
        userPassword: true,
      },
    })

    const contactlyTable = new Table(this, "ContactlyTable", {
      partitionKey: { name: "PK", type: AttributeType.STRING },
      sortKey: { name: "SK", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    // Health check lambda
    const healthFn = new NodejsFunction(this, "HealthFn", {
      runtime: Runtime.NODEJS_24_X,
      entry: path.join(__dirname, "../../packages/api/src/handlers/health.ts"),
      handler: "handler",
      bundling: { externalModules: ["@aws-sdk/*"] },
    })

    // HTTP API
    const httpApi = new HttpApi(this, "ContactlyHttpApi")

    // Route: GET /health -> healthFn
    httpApi.addRoutes({
      path: "/health",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("HealthIntegration", healthFn),
    })

    // Helper to define a contacts handler Lambda
    const handlerFn = (name: string, file: string) => {
      return new NodejsFunction(this, name, {
        runtime: Runtime.NODEJS_24_X,
        entry: path.join(__dirname, `../../packages/api/src/handlers/contacts/${file}`),
        bundling: { externalModules: ["@aws-sdk/*"] },
        environment: { TABLE_NAME: contactlyTable.tableName },
      })
    }

    // Contacts handlers
    const createFn = handlerFn("CreateContactFn", "create.ts")
    const listFn = handlerFn("ListContactsFn", "list.ts")
    const updateFn = handlerFn("UpdateContactFn", "update.ts")
    const deleteFn = handlerFn("DeleteContactFn", "delete.ts")

    // Least-privilege: each handler gets only the access it needs
    contactlyTable.grantWriteData(createFn)
    contactlyTable.grantReadData(listFn)
    contactlyTable.grantWriteData(updateFn)
    contactlyTable.grantWriteData(deleteFn)

    // JWT authorizer — API Gateway validates Cognito tokens before invoking any Lambda
    const authorizer = new HttpUserPoolAuthorizer("ContactsAuthorizer", userPool, {
      userPoolClients: [userPoolClient],
    })

    // Contacts routes
    httpApi.addRoutes({
      path: "/contacts",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("CreateIntegration", createFn),
      authorizer,
    })
    httpApi.addRoutes({
      path: "/contacts",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("ListIntegration", listFn),
      authorizer,
    })
    httpApi.addRoutes({
      path: "/contacts/{id}",
      methods: [HttpMethod.PUT],
      integration: new HttpLambdaIntegration("UpdateIntegration", updateFn),
      authorizer,
    })
    httpApi.addRoutes({
      path: "/contacts/{id}",
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration("DeleteIntegration", deleteFn),
      authorizer,
    })

    // Outputs
    new cdk.CfnOutput(this, "ApiUrl", {
      value: httpApi.url ?? "URL not available",
      description: "Base URL of the Contactly HTTP API",
    })
    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
      description: "Cognito User Pool ID",
    })
    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
      description: "Cognito User Pool Client ID",
    })
  }
}
