const ROUTE_TO_PATH = {
  '$connect':
    '/api/presence/ws/connect',
  '$disconnect':
    '/api/presence/ws/disconnect',
  heartbeat:
    '/api/presence/ws/heartbeat'
}

exports.handler = async event => {
  const routeKey =
    event?.requestContext
      ?.routeKey

  const path =
    ROUTE_TO_PATH[routeKey]

  if (!path) {
    return {
      statusCode: 200,
      body: 'ok'
    }
  }

  const backendUrl =
    process.env.PRESENCE_BACKEND_URL

  const bridgeKey =
    process.env.PRESENCE_BRIDGE_KEY

  if (
    !backendUrl ||
    !bridgeKey
  ) {
    console.error(
      'Presence bridge environment is incomplete'
    )

    return {
      statusCode: 500,
      body: 'Presence bridge is not configured'
    }
  }

  let messageBody = null

  if (event.body) {
    try {
      messageBody = JSON.parse(
        event.body
      )
    } catch {
      messageBody = null
    }
  }

  const payload = {
    connectionId:
      event.requestContext
        .connectionId,
    domainName:
      event.requestContext
        .domainName,
    stage:
      event.requestContext
        .stage,
    ticket:
      event.queryStringParameters
        ?.ticket || null,
    message:
      messageBody
  }

  try {
    const response = await fetch(
      `${backendUrl}${path}`,
      {
        method: 'POST',
        headers: {
          'content-type':
            'application/json',
          'x-presence-bridge-key':
            bridgeKey
        },
        body: JSON.stringify(
          payload
        )
      }
    )

    const text =
      await response.text()

    return {
      statusCode:
        response.status,
      body: text || 'ok'
    }
  } catch (error) {
    console.error(
      'Presence bridge request failed:',
      error
    )

    return {
      statusCode: 502,
      body:
        'Presence backend unavailable'
    }
  }
}
