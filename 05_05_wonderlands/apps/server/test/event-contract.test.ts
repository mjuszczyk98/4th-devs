import assert from 'node:assert/strict'
import { gunzipSync } from 'node:zlib'
import { test } from 'vitest'

import { eq } from 'drizzle-orm'
import { BACKEND_EVENT_TYPES } from '@wonderlands/contracts/chat'

import { createEventStore } from '../src/application/commands/event-store'
import { createDomainEventRepository } from '../src/domain/events/domain-event-repository'
import { createEventOutboxRepository } from '../src/domain/events/event-outbox-repository'
import {
  DOMAIN_EVENT_TYPES,
  TELEMETRY_EVENT_TYPES,
} from '../src/domain/events/committed-event-contract'
import {
  domainEvents,
  eventOutbox,
  eventPayloadSidecars,
  runs,
  sessionThreads,
  workSessions,
} from '../src/db/schema'
import { createToolExecutionRepository } from '../src/domain/runtime/tool-execution-repository'
import { seedApiKeyAuth } from './helpers/api-key-auth'
import { createTestHarness } from './helpers/create-test-app'

test('shared BackendEvent contract covers every canonical committed event type', () => {
  const canonicalEventTypes = [...DOMAIN_EVENT_TYPES, ...TELEMETRY_EVENT_TYPES].sort()
  const sharedEventTypes = [...BACKEND_EVENT_TYPES].sort()

  assert.deepEqual(sharedEventTypes, canonicalEventTypes)
})

test('event store defaults domain events to replayable category with projection and realtime delivery', () => {
  const { runtime } = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { accountId, tenantId } = seedApiKeyAuth(runtime)

  const appended = createEventStore(runtime.db).append({
    actorAccountId: accountId,
    aggregateId: 'ses_contract_domain',
    aggregateType: 'work_session',
    payload: {
      sessionId: 'ses_contract_domain',
    },
    tenantId,
    type: 'session.created',
  })

  assert.equal(appended.ok, true)

  if (!appended.ok) {
    throw new Error(appended.error.message)
  }

  const eventRow = runtime.db
    .select()
    .from(domainEvents)
    .where(eq(domainEvents.id, appended.value.id))
    .get()
  const outboxRows = runtime.db
    .select()
    .from(eventOutbox)
    .where(eq(eventOutbox.eventId, appended.value.id))
    .orderBy(eventOutbox.topic)
    .all()

  assert.equal(eventRow?.category, 'domain')
  assert.deepEqual(
    outboxRows.map((row) => row.topic),
    ['projection', 'realtime'],
  )
})

test('event store routes progress telemetry to realtime delivery only', () => {
  const { runtime } = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { accountId, tenantId } = seedApiKeyAuth(runtime)

  const appended = createEventStore(runtime.db).append({
    actorAccountId: accountId,
    aggregateId: 'run_contract_telemetry',
    aggregateType: 'run',
    payload: {
      runId: 'run_contract_telemetry',
      sessionId: 'ses_contract_telemetry',
      stage: 'planning',
      status: 'running',
      threadId: 'thr_contract_telemetry',
      turn: 1,
    },
    tenantId,
    type: 'progress.reported',
  })

  assert.equal(appended.ok, true)

  if (!appended.ok) {
    throw new Error(appended.error.message)
  }

  const eventRow = runtime.db
    .select()
    .from(domainEvents)
    .where(eq(domainEvents.id, appended.value.id))
    .get()
  const outboxRows = runtime.db
    .select()
    .from(eventOutbox)
    .where(eq(eventOutbox.eventId, appended.value.id))
    .all()

  assert.equal(eventRow?.category, 'telemetry')
  assert.deepEqual(outboxRows.map((row) => row.topic).sort(), ['realtime'])
})

test('event store offloads bulky telemetry payload fragments while repositories hydrate them transparently', () => {
  const { runtime } = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { accountId, tenantId } = seedApiKeyAuth(runtime)
  const createdAt = '2026-04-09T12:00:00.000Z'

  runtime.db
    .insert(workSessions)
    .values({
      createdAt,
      createdByAccountId: accountId,
      id: 'ses_contract_generation_started',
      metadata: null,
      rootRunId: null,
      status: 'active',
      tenantId,
      title: 'Contract Session',
      updatedAt: createdAt,
      workspaceId: null,
      workspaceRef: null,
    })
    .run()

  runtime.db
    .insert(sessionThreads)
    .values({
      createdAt,
      createdByAccountId: accountId,
      id: 'thr_contract_generation_started',
      parentThreadId: null,
      sessionId: 'ses_contract_generation_started',
      status: 'active',
      tenantId,
      title: 'Contract Thread',
      titleSource: 'manual',
      updatedAt: createdAt,
    })
    .run()

  runtime.db
    .insert(runs)
    .values({
      actorAccountId: accountId,
      completedAt: null,
      configSnapshot: {},
      createdAt,
      errorJson: null,
      id: 'run_contract_generation_started',
      lastProgressAt: createdAt,
      parentRunId: null,
      resultJson: null,
      rootRunId: 'run_contract_generation_started',
      sessionId: 'ses_contract_generation_started',
      sourceCallId: null,
      startedAt: createdAt,
      status: 'running',
      targetKind: 'assistant',
      task: 'Inspect telemetry storage',
      tenantId,
      threadId: 'thr_contract_generation_started',
      toolProfileId: null,
      turnCount: 0,
      updatedAt: createdAt,
      version: 1,
      jobId: null,
      workspaceId: null,
      workspaceRef: null,
      agentId: null,
      agentRevisionId: null,
    })
    .run()

  runtime.db
    .update(workSessions)
    .set({
      rootRunId: 'run_contract_generation_started',
      updatedAt: createdAt,
    })
    .where(eq(workSessions.id, 'ses_contract_generation_started'))
    .run()

  const toolExecutionStored = createToolExecutionRepository(runtime.db).create(
    { accountId, tenantId },
    {
      argsJson: {
        command: 'echo test',
      },
      createdAt,
      domain: 'native',
      id: 'call_generation_started_output',
      runId: 'run_contract_generation_started',
      startedAt: createdAt,
      tool: 'execute',
    },
  )

  assert.equal(toolExecutionStored.ok, true)

  if (!toolExecutionStored.ok) {
    throw new Error(toolExecutionStored.error.message)
  }

  const toolExecutionCompleted = createToolExecutionRepository(runtime.db).complete(
    { accountId, tenantId },
    {
      completedAt: '2026-04-09T12:00:01.000Z',
      durationMs: 1000,
      id: 'call_generation_started_output',
      outcomeJson: {
        ok: true,
        stdout: 'hello from execute',
      },
    },
  )

  assert.equal(toolExecutionCompleted.ok, true)

  if (!toolExecutionCompleted.ok) {
    throw new Error(toolExecutionCompleted.error.message)
  }

  const appended = createEventStore(runtime.db).append({
    actorAccountId: accountId,
    aggregateId: 'run_contract_generation_started',
    aggregateType: 'run',
    payload: {
      inputMessages: [
        {
          content: [
            {
              callId: 'call_generation_started_output',
              name: 'execute',
              outputJson: JSON.stringify({
                ok: true,
                stdout: 'hello from execute',
              }),
              type: 'function_result',
            },
            {
              text: 'x'.repeat(1600),
              type: 'text',
            },
          ],
          role: 'user',
        },
      ],
      modelParameters: {
        maxOutputTokens: 800,
      },
      provider: 'openai',
      requestedModel: 'gpt-5.4',
      runId: 'run_contract_generation_started',
      sessionId: 'ses_contract_generation_started',
      status: 'running',
      threadId: 'thr_contract_generation_started',
      tools: [
        {
          description: 'Inspect a large telemetry payload.',
          kind: 'function',
          name: 'inspect_payload',
          parameters: {
            additionalProperties: false,
            properties: {
              text: {
                type: 'string',
              },
            },
            required: ['text'],
            type: 'object',
          },
          type: 'function',
        },
      ],
      turn: 1,
    },
    tenantId,
    type: 'generation.started',
  })

  assert.equal(appended.ok, true)

  if (!appended.ok) {
    throw new Error(appended.error.message)
  }

  const eventRow = runtime.db
    .select()
    .from(domainEvents)
    .where(eq(domainEvents.id, appended.value.id))
    .get()
  const payloadSidecarRow = runtime.db
    .select()
    .from(eventPayloadSidecars)
    .where(eq(eventPayloadSidecars.eventId, appended.value.id))
    .get()

  assert.ok(eventRow)
  assert.ok(payloadSidecarRow)
  assert.equal(
    Object.hasOwn((eventRow?.payload as Record<string, unknown>) ?? {}, 'inputMessages'),
    false,
  )
  assert.equal(
    Object.hasOwn((eventRow?.payload as Record<string, unknown>) ?? {}, 'tools'),
    false,
  )

  const decodedSidecarPayload = JSON.parse(
    gunzipSync(Buffer.from(payloadSidecarRow?.payloadCompressed ?? Buffer.alloc(0))).toString('utf8'),
  ) as {
    inputMessages?: Array<{
      content?: Array<Record<string, unknown>>
    }>
  }
  const storedFunctionResult = decodedSidecarPayload.inputMessages?.[0]?.content?.find(
    (part) => part.type === 'function_result',
  )

  assert.equal(Object.hasOwn(storedFunctionResult ?? {}, 'outputJson'), false)
  assert.deepEqual((storedFunctionResult as { outputRef?: unknown } | undefined)?.outputRef, {
    callId: 'call_generation_started_output',
    kind: 'tool_execution',
  })

  const hydratedEvents = createDomainEventRepository(runtime.db).listAfterCursor(
    { accountId, tenantId },
    {
      category: 'telemetry',
      runId: 'run_contract_generation_started',
    },
  )

  assert.equal(hydratedEvents.ok, true)

  if (!hydratedEvents.ok) {
    throw new Error(hydratedEvents.error.message)
  }

  const hydratedStartedEvent = hydratedEvents.value.find(
    (event) => event.type === 'generation.started',
  )
  const claimed = createEventOutboxRepository(runtime.db).claimNext('9999-01-01T00:00:00.000Z', {
    includeTopics: ['realtime'],
  })

  assert.equal(claimed.ok, true)

  if (!claimed.ok) {
    throw new Error(claimed.error.message)
  }

  assert.equal(
    Array.isArray((hydratedStartedEvent?.payload as { inputMessages?: unknown[] } | undefined)?.inputMessages),
    true,
  )
  assert.equal(
    Array.isArray((hydratedStartedEvent?.payload as { tools?: unknown[] } | undefined)?.tools),
    true,
  )
  assert.equal(
    Array.isArray((claimed.value?.event.payload as { inputMessages?: unknown[] } | undefined)?.inputMessages),
    true,
  )
  const hydratedFunctionResult = (
    hydratedStartedEvent?.payload as {
      inputMessages?: Array<{
        content?: Array<Record<string, unknown>>
      }>
    }
  )?.inputMessages?.[0]?.content?.find((part) => part.type === 'function_result')

  assert.equal(
    (hydratedFunctionResult as { outputJson?: string } | undefined)?.outputJson,
    JSON.stringify({
      ok: true,
      stdout: 'hello from execute',
    }),
  )
})

test('event store routes run.created to projection and realtime delivery', () => {
  const { runtime } = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { accountId, tenantId } = seedApiKeyAuth(runtime)

  const appended = createEventStore(runtime.db).append({
    actorAccountId: accountId,
    aggregateId: 'run_contract_created',
    aggregateType: 'run',
    payload: {
      rootRunId: 'run_contract_created',
      runId: 'run_contract_created',
      sessionId: 'ses_contract_created',
      threadId: 'thr_contract_created',
    },
    tenantId,
    type: 'run.created',
  })

  assert.equal(appended.ok, true)

  if (!appended.ok) {
    throw new Error(appended.error.message)
  }

  const outboxRows = runtime.db
    .select()
    .from(eventOutbox)
    .where(eq(eventOutbox.eventId, appended.value.id))
    .orderBy(eventOutbox.topic)
    .all()

  assert.deepEqual(
    outboxRows.map((row) => row.topic),
    ['projection', 'realtime'],
  )
})

test('event store defaults thread.naming.requested to background and realtime delivery', () => {
  const { runtime } = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { accountId, tenantId } = seedApiKeyAuth(runtime)

  const appended = createEventStore(runtime.db).append({
    actorAccountId: accountId,
    aggregateId: 'thr_contract_naming',
    aggregateType: 'session_thread',
    payload: {
      requestId: 'tnr_contract_naming',
      requestedAt: '2026-03-31T12:00:00.000Z',
      sessionId: 'ses_contract_naming',
      sourceRunId: 'run_contract_naming',
      threadId: 'thr_contract_naming',
      trigger: 'auto_first_message',
    },
    tenantId,
    type: 'thread.naming.requested',
  })

  assert.equal(appended.ok, true)

  if (!appended.ok) {
    throw new Error(appended.error.message)
  }

  const outboxRows = runtime.db
    .select()
    .from(eventOutbox)
    .where(eq(eventOutbox.eventId, appended.value.id))
    .orderBy(eventOutbox.topic)
    .all()

  assert.deepEqual(
    outboxRows.map((row) => row.topic),
    ['background', 'realtime'],
  )
})

test('event store accepts tool.waiting as a canonical domain event', () => {
  const { runtime } = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { accountId, tenantId } = seedApiKeyAuth(runtime)

  const appended = createEventStore(runtime.db).append({
    actorAccountId: accountId,
    aggregateId: 'call_contract_waiting',
    aggregateType: 'tool_execution',
    payload: {
      callId: 'call_contract_waiting',
      runId: 'run_contract_waiting',
      sessionId: 'ses_contract_waiting',
      threadId: 'thr_contract_waiting',
      tool: 'fetch_report',
      waitId: 'wte_contract_waiting',
      waitTargetKind: 'external',
      waitTargetRef: 'job_123',
      waitType: 'tool',
    },
    tenantId,
    type: 'tool.waiting',
  })

  assert.equal(appended.ok, true)

  if (!appended.ok) {
    throw new Error(appended.error.message)
  }

  const eventRow = runtime.db
    .select()
    .from(domainEvents)
    .where(eq(domainEvents.id, appended.value.id))
    .get()
  const outboxRows = runtime.db
    .select()
    .from(eventOutbox)
    .where(eq(eventOutbox.eventId, appended.value.id))
    .orderBy(eventOutbox.topic)
    .all()

  assert.equal(eventRow?.category, 'domain')
  assert.deepEqual(
    outboxRows.map((row) => row.topic),
    ['projection', 'realtime'],
  )
})

test('event store routes root run.completed to projection, realtime, and observability delivery', () => {
  const { runtime } = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { accountId, tenantId } = seedApiKeyAuth(runtime)

  const appended = createEventStore(runtime.db).append({
    actorAccountId: accountId,
    aggregateId: 'run_contract_completed_root',
    aggregateType: 'run',
    payload: {
      rootRunId: 'run_contract_completed_root',
      runId: 'run_contract_completed_root',
      sessionId: 'ses_contract_completed_root',
      status: 'completed',
      threadId: 'thr_contract_completed_root',
    },
    tenantId,
    type: 'run.completed',
  })

  assert.equal(appended.ok, true)

  if (!appended.ok) {
    throw new Error(appended.error.message)
  }

  const outboxRows = runtime.db
    .select()
    .from(eventOutbox)
    .where(eq(eventOutbox.eventId, appended.value.id))
    .orderBy(eventOutbox.topic)
    .all()

  assert.deepEqual(
    outboxRows.map((row) => row.topic),
    ['observability', 'projection', 'realtime'],
  )
})

test('event store routes child run.completed to projection and realtime delivery only', () => {
  const { runtime } = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { accountId, tenantId } = seedApiKeyAuth(runtime)

  const appended = createEventStore(runtime.db).append({
    actorAccountId: accountId,
    aggregateId: 'run_contract_completed_child',
    aggregateType: 'run',
    payload: {
      rootRunId: 'run_contract_completed_root',
      runId: 'run_contract_completed_child',
      sessionId: 'ses_contract_completed_root',
      status: 'completed',
      threadId: 'thr_contract_completed_root',
    },
    tenantId,
    type: 'run.completed',
  })

  assert.equal(appended.ok, true)

  if (!appended.ok) {
    throw new Error(appended.error.message)
  }

  const outboxRows = runtime.db
    .select()
    .from(eventOutbox)
    .where(eq(eventOutbox.eventId, appended.value.id))
    .orderBy(eventOutbox.topic)
    .all()

  assert.deepEqual(
    outboxRows.map((row) => row.topic),
    ['projection', 'realtime'],
  )
})

test('event store accepts job.requeued as a canonical domain event', () => {
  const { runtime } = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { accountId, tenantId } = seedApiKeyAuth(runtime)

  const appended = createEventStore(runtime.db).append({
    actorAccountId: accountId,
    aggregateId: 'job_contract_reopened',
    aggregateType: 'job',
    payload: {
      currentRunId: 'run_contract_reopened',
      kind: 'objective',
      parentJobId: null,
      reason: 'dependencies_satisfied',
      rootJobId: 'job_contract_reopened',
      runId: 'run_contract_reopened',
      sessionId: 'ses_contract_reopened',
      status: 'queued',
      threadId: 'thr_contract_reopened',
      updatedAt: '2026-03-30T00:00:00.000Z',
      jobId: 'job_contract_reopened',
    },
    tenantId,
    type: 'job.requeued',
  })

  assert.equal(appended.ok, true)

  if (!appended.ok) {
    throw new Error(appended.error.message)
  }

  const eventRow = runtime.db
    .select()
    .from(domainEvents)
    .where(eq(domainEvents.id, appended.value.id))
    .get()
  const outboxRows = runtime.db
    .select()
    .from(eventOutbox)
    .where(eq(eventOutbox.eventId, appended.value.id))
    .orderBy(eventOutbox.topic)
    .all()

  assert.equal(eventRow?.category, 'domain')
  assert.deepEqual(
    outboxRows.map((row) => row.topic),
    ['projection', 'realtime'],
  )
})

test('event store rejects category mismatches for canonical committed event types', () => {
  const { runtime } = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { accountId, tenantId } = seedApiKeyAuth(runtime)

  const appended = createEventStore(runtime.db).append({
    actorAccountId: accountId,
    aggregateId: 'run_contract_mismatch',
    aggregateType: 'run',
    category: 'domain',
    payload: {
      runId: 'run_contract_mismatch',
      sessionId: 'ses_contract_mismatch',
      stage: 'planning',
      status: 'running',
      threadId: 'thr_contract_mismatch',
      turn: 1,
    },
    tenantId,
    type: 'progress.reported',
  })

  assert.equal(appended.ok, false)

  if (appended.ok) {
    throw new Error('expected event append to fail')
  }

  assert.match(appended.error.message, /must use category "telemetry"/)
})

test('event store rejects outbox topics outside the canonical delivery contract', () => {
  const { runtime } = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { accountId, tenantId } = seedApiKeyAuth(runtime)

  const appended = createEventStore(runtime.db).append({
    actorAccountId: accountId,
    aggregateId: 'run_contract_bad_topic',
    aggregateType: 'run',
    outboxTopics: ['projection'],
    payload: {
      runId: 'run_contract_bad_topic',
      sessionId: 'ses_contract_bad_topic',
      stage: 'planning',
      status: 'running',
      threadId: 'thr_contract_bad_topic',
      turn: 1,
    },
    tenantId,
    type: 'progress.reported',
  })

  assert.equal(appended.ok, false)

  if (appended.ok) {
    throw new Error('expected event append to fail')
  }

  assert.match(appended.error.message, /does not support the requested outbox topics/)
})
