import { gunzipSync, gzipSync } from 'node:zlib'

import { eq, inArray } from 'drizzle-orm'

import { toolExecutions, eventPayloadSidecars } from '../../db/schema'
import { toMappedFunctionOutputJson } from '../../application/interactions/build-run-interaction-request'
import type { DomainError } from '../../shared/errors'
import { err, ok, type Result } from '../../shared/result'
import type { RepositoryDatabase } from '../database-port'

const PAYLOAD_SIDECAR_ENCODING = 'gzip-json-v1'
const PAYLOAD_SIDECAR_MIN_BYTES = 1024

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const EVENT_PAYLOAD_SIDECAR_KEYS: Partial<Record<string, readonly string[]>> = {
  'generation.completed': ['outputItems', 'outputMessages', 'toolCalls'],
  'generation.started': ['inputMessages', 'tools'],
}

interface ToolExecutionOutputReference {
  callId: string
  kind: 'tool_execution'
}

const encodePayloadFragment = (payload: Record<string, unknown>): Buffer | null => {
  try {
    return gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'))
  } catch {
    return null
  }
}

const decodePayloadFragment = (buffer: Buffer): Record<string, unknown> | null => {
  try {
    const decoded = JSON.parse(gunzipSync(buffer).toString('utf8'))
    return isRecord(decoded) ? decoded : null
  } catch {
    return null
  }
}

const isToolExecutionOutputReference = (value: unknown): value is ToolExecutionOutputReference =>
  isRecord(value) &&
  value.kind === 'tool_execution' &&
  typeof value.callId === 'string' &&
  value.callId.length > 0

const normalizeFunctionResultForStorage = (
  value: Record<string, unknown>,
): Record<string, unknown> => {
  if (
    value.type !== 'function_result' ||
    typeof value.callId !== 'string' ||
    value.callId.length === 0 ||
    typeof value.name !== 'string' ||
    value.name.length === 0 ||
    typeof value.outputJson !== 'string'
  ) {
    return value
  }

  const normalized = { ...value }

  delete normalized.outputJson
  normalized.outputRef = {
    callId: value.callId,
    kind: 'tool_execution',
  } satisfies ToolExecutionOutputReference

  return normalized
}

const normalizeSidecarValueForStorage = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeSidecarValueForStorage(entry))
  }

  if (!isRecord(value)) {
    return value
  }

  const normalizedEntries = Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, normalizeSidecarValueForStorage(entry)]),
  )

  return normalizeFunctionResultForStorage(normalizedEntries)
}

const collectToolExecutionRefs = (value: unknown, refs: Set<string>): void => {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectToolExecutionRefs(entry, refs)
    }

    return
  }

  if (!isRecord(value)) {
    return
  }

  if (isToolExecutionOutputReference(value.outputRef)) {
    refs.add(value.outputRef.callId)
  }

  for (const entry of Object.values(value)) {
    collectToolExecutionRefs(entry, refs)
  }
}

const hydrateToolExecutionRefs = (
  value: unknown,
  outputsByCallId: Map<string, string>,
): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => hydrateToolExecutionRefs(entry, outputsByCallId))
  }

  if (!isRecord(value)) {
    return value
  }

  const hydratedEntries = Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, hydrateToolExecutionRefs(entry, outputsByCallId)]),
  )

  if (
    hydratedEntries.type === 'function_result' &&
    typeof hydratedEntries.name === 'string' &&
    hydratedEntries.name.length > 0 &&
    isToolExecutionOutputReference(hydratedEntries.outputRef)
  ) {
    const storedOutput = outputsByCallId.get(hydratedEntries.outputRef.callId)

    if (storedOutput) {
      delete hydratedEntries.outputRef
      hydratedEntries.outputJson = toMappedFunctionOutputJson(hydratedEntries.name, storedOutput)
    }
  }

  return hydratedEntries
}

export const splitEventPayloadForStorage = (
  type: string,
  payload: unknown,
): {
  primaryPayload: unknown
  sidecarPayload: Record<string, unknown> | null
} => {
  if (!isRecord(payload)) {
    return {
      primaryPayload: payload,
      sidecarPayload: null,
    }
  }

  const sidecarKeys = EVENT_PAYLOAD_SIDECAR_KEYS[type]

  if (!sidecarKeys || sidecarKeys.length === 0) {
    return {
      primaryPayload: payload,
      sidecarPayload: null,
    }
  }

  const primaryPayload: Record<string, unknown> = { ...payload }
  const sidecarPayload: Record<string, unknown> = {}

  for (const key of sidecarKeys) {
    if (!Object.hasOwn(payload, key)) {
      continue
    }

    sidecarPayload[key] = payload[key]
    delete primaryPayload[key]
  }

  if (Object.keys(sidecarPayload).length === 0) {
    return {
      primaryPayload: payload,
      sidecarPayload: null,
    }
  }

  try {
    const normalizedSidecarPayload = normalizeSidecarValueForStorage(sidecarPayload)
    const serialized = JSON.stringify(normalizedSidecarPayload)

    if (Buffer.byteLength(serialized, 'utf8') < PAYLOAD_SIDECAR_MIN_BYTES) {
      return {
        primaryPayload: payload,
        sidecarPayload: null,
      }
    }
  } catch {
    return {
      primaryPayload: payload,
      sidecarPayload: null,
    }
  }

  return {
    primaryPayload,
    sidecarPayload: normalizeSidecarValueForStorage(sidecarPayload) as Record<string, unknown>,
  }
}

export const hydrateStoredEventPayload = (
  payload: unknown,
  sidecarPayload: Record<string, unknown> | null | undefined,
): unknown => {
  if (!sidecarPayload) {
    return payload
  }

  if (!isRecord(payload)) {
    return sidecarPayload
  }

  return {
    ...payload,
    ...sidecarPayload,
  }
}

export const createEventPayloadSidecarRepository = (db: RepositoryDatabase) => ({
  create: (input: {
    createdAt: string
    eventId: string
    payload: Record<string, unknown>
  }): Result<null, DomainError> => {
    try {
      const payloadCompressed = encodePayloadFragment(input.payload)

      if (!payloadCompressed) {
        return err({
          message: `failed to encode payload sidecar for event ${input.eventId}`,
          type: 'conflict',
        })
      }

      db.insert(eventPayloadSidecars)
        .values({
          createdAt: input.createdAt,
          encoding: PAYLOAD_SIDECAR_ENCODING,
          eventId: input.eventId,
          payloadCompressed,
        })
        .run()

      return ok(null)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown event payload sidecar write failure'

      return err({
        message: `failed to persist payload sidecar for event ${input.eventId}: ${message}`,
        type: 'conflict',
      })
    }
  },
  listByEventIds: (eventIds: string[]): Result<Map<string, Record<string, unknown>>, DomainError> => {
    if (eventIds.length === 0) {
      return ok(new Map())
    }

    try {
      const rows = db
        .select({
          encoding: eventPayloadSidecars.encoding,
          eventId: eventPayloadSidecars.eventId,
          payloadCompressed: eventPayloadSidecars.payloadCompressed,
        })
        .from(eventPayloadSidecars)
        .where(inArray(eventPayloadSidecars.eventId, eventIds))
        .all()

      const payloads = new Map<string, Record<string, unknown>>()
      const toolExecutionIds = new Set<string>()

      for (const row of rows) {
        if (row.encoding !== PAYLOAD_SIDECAR_ENCODING) {
          return err({
            message: `event ${row.eventId} uses unsupported payload sidecar encoding "${row.encoding}"`,
            type: 'conflict',
          })
        }

        const payload = decodePayloadFragment(Buffer.from(row.payloadCompressed))

        if (!payload) {
          return err({
            message: `failed to decode payload sidecar for event ${row.eventId}`,
            type: 'conflict',
          })
        }

        payloads.set(row.eventId, payload)
        collectToolExecutionRefs(payload, toolExecutionIds)
      }

      const outputsByCallId = new Map<string, string>()

      if (toolExecutionIds.size > 0) {
        const toolExecutionRows = db
          .select({
            id: toolExecutions.id,
            outcomeJson: toolExecutions.outcomeJson,
          })
          .from(toolExecutions)
          .where(inArray(toolExecutions.id, [...toolExecutionIds]))
          .all()

        for (const row of toolExecutionRows) {
          outputsByCallId.set(row.id, JSON.stringify(row.outcomeJson ?? null))
        }
      }

      for (const [eventId, payload] of payloads.entries()) {
        payloads.set(
          eventId,
          hydrateToolExecutionRefs(payload, outputsByCallId) as Record<string, unknown>,
        )
      }

      return ok(payloads)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown event payload sidecar query failure'

      return err({
        message: `failed to query payload sidecars: ${message}`,
        type: 'conflict',
      })
    }
  },
  removeByEventId: (eventId: string): Result<null, DomainError> => {
    try {
      db.delete(eventPayloadSidecars).where(eq(eventPayloadSidecars.eventId, eventId)).run()
      return ok(null)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown event payload sidecar delete failure'

      return err({
        message: `failed to delete payload sidecar for event ${eventId}: ${message}`,
        type: 'conflict',
      })
    }
  },
})
