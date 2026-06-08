#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core"
import { ContactlyStack } from "../lib/contactly-stack"

const app = new cdk.App()

new ContactlyStack(app, "ContactlyStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
})
