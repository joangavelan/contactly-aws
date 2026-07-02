import { UpdateCommand } from "@aws-sdk/lib-dynamodb"
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda"
import { getUserId } from "../../shared/auth"
import { db, TABLE } from "../../shared/db"
import { badRequest, json, notFound } from "../../shared/http"
import { contactSk, userPk } from "../../shared/keys"

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const userId = getUserId(event)
  const id = event.pathParameters?.id

  if (!id) {
    return badRequest("contact id is required")
  }

  const body = JSON.parse(event.body ?? "{}")
  const { name, email, phone } = body

  if (typeof name !== "string" || name.trim() === "") {
    return badRequest("name is required")
  }

  try {
    const result = await db.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: userPk(userId), SK: contactSk(id) },
        UpdateExpression: "SET #name = :name, email = :email, phone = :phone",
        ExpressionAttributeNames: { "#name": "name" },
        ExpressionAttributeValues: {
          ":name": name,
          ":email": email ?? null,
          ":phone": phone ?? null,
        },
        ConditionExpression: "attribute_exists(PK)",
        ReturnValues: "ALL_NEW",
      })
    )
    return json(200, result.Attributes)
  } catch (err) {
    if (err instanceof Error && err.name === "ConditionalCheckFailedException") {
      return notFound("contact not found")
    }
    throw err
  }
}
