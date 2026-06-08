import { HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import * as path from "node:path";

export class ContactlyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Health check lambda
    const healthFn = new NodejsFunction(this, "HealthFn", {
      runtime: Runtime.NODEJS_24_X,
      entry: path.join(__dirname, "../../packages/api/src/handlers/health.ts"),
      handler: 'handler',
      bundling: { externalModules: ["@aws-sdk/*"]}
    })

    // HTTP API
    const httpApi = new HttpApi(this, "ContactlyHttpApi")

    // Route: GET /health -> healthFn
    httpApi.addRoutes({
      path: "/health",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("HealthIntegration", healthFn)
    })

    new cdk.CfnOutput(this, "ApiUrl", {
      value: httpApi.url!,
      description: "Base URL of the Contactly HTTP API"
    })
  }
  }
