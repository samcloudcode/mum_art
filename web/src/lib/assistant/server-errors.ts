import { APIConnectionError, APIConnectionTimeoutError } from '@anthropic-ai/sdk'

type AssistantErrorDetails = {
  name: string
  message?: string
  status?: number
  requestId?: string
}

type AssistantErrorResponse = {
  status: number
  code: string
  error: string
}

export function assistantErrorDetails(error: unknown): AssistantErrorDetails {
  if (!(error instanceof Error)) return { name: 'UnknownError' }
  const apiError = error as Error & {
    status?: unknown
    request_id?: unknown
    requestID?: unknown
  }
  const requestId = typeof apiError.requestID === 'string'
    ? apiError.requestID
    : typeof apiError.request_id === 'string'
      ? apiError.request_id
      : undefined
  return {
    name: error.name,
    message: error.message,
    status: typeof apiError.status === 'number' ? apiError.status : undefined,
    requestId,
  }
}

export function assistantErrorResponse(error: unknown): AssistantErrorResponse {
  const details = assistantErrorDetails(error)
  const unchanged = 'No inventory was changed.'

  if (error instanceof APIConnectionTimeoutError) {
    return {
      status: 504,
      code: 'assistant_timeout',
      error: `The assistant took too long to respond. ${unchanged} Please try again, or make the request a little narrower.`,
    }
  }
  if (details.status === 429) {
    return {
      status: 429,
      code: 'assistant_busy',
      error: `The AI service is busy at the moment. ${unchanged} Please wait a minute and try again.`,
    }
  }
  if (details.status === 401 || details.status === 403) {
    return {
      status: 503,
      code: 'assistant_configuration',
      error: `The assistant service is not correctly authorised. ${unchanged} Please ask an administrator to check its configuration.`,
    }
  }
  if (details.status === 400 || details.status === 404 || details.status === 422) {
    return {
      status: 502,
      code: 'assistant_request_rejected',
      error: `The AI service could not process this request. ${unchanged} The problem has been logged; please try again after it has been checked.`,
    }
  }
  if ((details.status !== undefined && details.status >= 500) || error instanceof APIConnectionError) {
    return {
      status: 503,
      code: 'assistant_unavailable',
      error: `The AI service is temporarily unavailable. ${unchanged} Please wait a moment and try again.`,
    }
  }
  return {
    status: 502,
    code: 'assistant_failed',
    error: `The assistant ran into an unexpected problem while checking the records. ${unchanged} Please try again; if it continues, report the request shown above.`,
  }
}
