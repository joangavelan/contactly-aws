export function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }
}

export function badRequest(message: string) {
  return json(400, { error: message })
}

export function notFound(message: string) {
  return json(404, { error: message })
}
