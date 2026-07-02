import { randomUUID } from "node:crypto"
import { PutCommand } from "@aws-sdk/lib-dynamodb"
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda"
import { getUserId } from "../../shared/auth"
import { db, TABLE } from "../../shared/db"
import { badRequest, json } from "../../shared/http"
import { contactSk, userPk } from "../../shared/keys"

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const userId = getUserId(event)
  const body = JSON.parse(event.body ?? "{}")
  const { name, email, phone } = body

  if (typeof name !== "string" || name.trim() === "") {
    return badRequest("name is required")
  }

  const id = randomUUID()
  const item = {
    PK: userPk(userId),
    SK: contactSk(id),
    id,
    name,
    email: email ?? null,
    phone: phone ?? null,
    createdAt: new Date().toISOString(),
  }

  await db.send(new PutCommand({ TableName: TABLE, Item: item }))

  return json(201, item)
}
