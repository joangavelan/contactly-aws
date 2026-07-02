import { QueryCommand } from "@aws-sdk/lib-dynamodb"
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda"
import { getUserId } from "../../shared/auth"
import { db, TABLE } from "../../shared/db"
import { json } from "../../shared/http"
import { contactPrefix, userPk } from "../../shared/keys"

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const userId = getUserId(event)

  const result = await db.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :sk)",
      ExpressionAttributeNames: { "#pk": "PK", "#sk": "SK" },
      ExpressionAttributeValues: {
        ":pk": userPk(userId),
        ":sk": contactPrefix,
      },
    })
  )

  return json(200, { contacts: result.Items ?? [] })
}
