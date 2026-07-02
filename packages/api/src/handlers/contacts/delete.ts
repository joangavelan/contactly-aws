import { DeleteCommand } from "@aws-sdk/lib-dynamodb"
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

  try {
    await db.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: { PK: userPk(userId), SK: contactSk(id) },
        ConditionExpression: "attribute_exists(PK)",
      })
    )
    return json(200, { deleted: id })
  } catch (err) {
    if (err instanceof Error && err.name === "ConditionalCheckFailedException") {
      return notFound("contact not found")
    }
    throw err
  }
}
