import {
  assert,
  bootstrapPlannerRun,
  closeAppRuntime,
  createAppRuntime,
  createTestHarness,
  domainEvents,
  drainWorker,
  eq,
  executeRun,
  initializeAppRuntime,
  jobs,
  ok,
  registerFunctionTool,
  runDependencies,
  runs,
  seedApiKeyAuth,
  sessionMessages,
  test,
  toolExecutions,
  wireStreamingStub,
  buildAssistantResponse,
} from './helpers/multiagent-worker'
import type { AiInteractionRequest, AiInteractionResponse } from './helpers/multiagent-worker'

test('worker times out expired waits, persists timeout failure, and resumes the run', async () => {
  const { app, runtime } = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { headers } = seedApiKeyAuth(runtime)
  const timeoutAt = '2000-01-01T00:00:00.000Z'
  const timeoutEnvelope = {
    error: {
      message: 'Wait timed out before external input arrived',
      type: 'timeout',
    },
    ok: false,
  }

  registerFunctionTool(runtime, {
    execute: async () =>
      ok({
        kind: 'waiting' as const,
        wait: {
          description: 'Waiting for upstream system',
          targetKind: 'external' as const,
          targetRef: 'job_timeout_1',
          timeoutAt,
          type: 'tool' as const,
        },
      }),
    name: 'await_upstream',
  })

  const bootstrap = await executeWaitBootstrap(app, headers)
  let callCount = 0
  let resumedRequest: AiInteractionRequest | null = null

  runtime.services.ai.interactions.generate = async (request: AiInteractionRequest) => {
    callCount += 1

    if (callCount === 1) {
      return ok<AiInteractionResponse>({
        messages: [],
        model: 'gpt-5.4',
        output: [
          {
            arguments: {},
            argumentsJson: '{}',
            callId: 'call_timeout_wait_1',
            name: 'await_upstream',
            type: 'function_call',
          },
        ],
        outputText: '',
        provider: 'openai',
        providerRequestId: 'req_timeout_wait_1',
        raw: { stub: true },
        responseId: 'resp_timeout_wait_1',
        status: 'completed',
        toolCalls: [
          {
            arguments: {},
            argumentsJson: '{}',
            callId: 'call_timeout_wait_1',
            name: 'await_upstream',
          },
        ],
        usage: null,
      })
    }

    resumedRequest = request

    return ok(buildAssistantResponse('Timeout recovered and the run completed.'))
  }

  const execution = await executeRun(app, headers, bootstrap.data.runId)

  assert.equal(execution.response.status, 202)
  assert.equal(execution.body.data.status, 'waiting')
  assert.equal(runtime.db.select().from(runDependencies).get()?.status, 'pending')
  assert.equal(
    runtime.db
      .select()
      .from(jobs)
      .all()
      .find((workItem) => workItem.currentRunId === bootstrap.data.runId)?.nextSchedulerCheckAt,
    timeoutAt,
  )

  const worked = await runtime.services.multiagent.processAvailableDecisions()

  assert.equal(worked, true)
  assert.equal(callCount, 2)

  const waitRow = runtime.db.select().from(runDependencies).get()
  const toolRow = runtime.db.select().from(toolExecutions).get()
  const runRow = runtime.db.select().from(runs).where(eq(runs.id, bootstrap.data.runId)).get()
  const resumedEvent = runtime.db
    .select()
    .from(domainEvents)
    .all()
    .find((event) => event.type === 'run.resumed')
  const eventTypes = runtime.db
    .select()
    .from(domainEvents)
    .all()
    .map((event) => event.type)

  assert.equal(waitRow?.status, 'timed_out')
  assert.deepEqual(waitRow?.resolutionJson, {
    error: 'Wait timed out before external input arrived',
    timeoutAt,
  })
  assert.equal(toolRow?.errorText, 'Wait timed out before external input arrived')
  assert.deepEqual(toolRow?.outcomeJson, timeoutEnvelope)
  assert.equal(runRow?.status, 'completed')
  assert.equal(eventTypes.includes('wait.timed_out'), true)
  assert.equal(eventTypes.includes('tool.failed'), true)
  assert.equal(eventTypes.includes('run.resumed'), true)
  assert.equal(
    (resumedEvent?.payload as { reason?: unknown } | undefined)?.reason,
    'dependencies_satisfied',
  )

  assert.ok(resumedRequest)
  assert.equal(resumedRequest?.messages.at(-1)?.role, 'tool')
  assert.deepEqual(resumedRequest?.messages.at(-1)?.content[0], {
    callId: 'call_timeout_wait_1',
    isError: true,
    name: 'await_upstream',
    outputJson: JSON.stringify(timeoutEnvelope),
    type: 'function_result',
  })
})

test('runtime startup reconciliation times out expired waits and resumes the run before polling starts', async () => {
  const harness = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { app, config, runtime } = harness
  const { headers } = seedApiKeyAuth(runtime)
  const timeoutAt = '2000-01-01T00:00:00.000Z'
  let initialCallCount = 0
  let restartCallCount = 0

  registerFunctionTool(runtime, {
    execute: async () =>
      ok({
        kind: 'waiting' as const,
        wait: {
          description: 'Waiting for upstream system',
          targetKind: 'external' as const,
          targetRef: 'job_timeout_startup_1',
          timeoutAt,
          type: 'tool' as const,
        },
      }),
    name: 'await_upstream_startup',
  })

  const bootstrap = await executeWaitBootstrap(app, headers)

  runtime.services.ai.interactions.generate = async () => {
    initialCallCount += 1

    return ok<AiInteractionResponse>({
      messages: [],
      model: 'gpt-5.4',
      output: [
        {
          arguments: {},
          argumentsJson: '{}',
          callId: 'call_timeout_startup_wait_1',
          name: 'await_upstream_startup',
          type: 'function_call',
        },
      ],
      outputText: '',
      provider: 'openai',
      providerRequestId: 'req_timeout_startup_wait_1',
      raw: { stub: true },
      responseId: 'resp_timeout_startup_wait_1',
      status: 'completed',
      toolCalls: [
        {
          arguments: {},
          argumentsJson: '{}',
          callId: 'call_timeout_startup_wait_1',
          name: 'await_upstream_startup',
        },
      ],
      usage: null,
    })
  }

  const execution = await executeRun(app, headers, bootstrap.data.runId)

  assert.equal(execution.response.status, 202)
  assert.equal(execution.body.data.status, 'waiting')

  await closeAppRuntime(runtime)

  const restartedRuntime = createAppRuntime(config)
  restartedRuntime.services.ai.interactions.generate = async () => {
    restartCallCount += 1
    return ok(buildAssistantResponse('Startup timeout reconciliation resumed the run.'))
  }
  wireStreamingStub(restartedRuntime)

  await initializeAppRuntime(restartedRuntime)

  const waitRow = restartedRuntime.db.select().from(runDependencies).get()
  const toolRow = restartedRuntime.db.select().from(toolExecutions).get()
  const runRow = restartedRuntime.db
    .select()
    .from(runs)
    .where(eq(runs.id, bootstrap.data.runId))
    .get()
  const assistantReply = restartedRuntime.db
    .select()
    .from(sessionMessages)
    .where(eq(sessionMessages.runId, bootstrap.data.runId))
    .all()
    .find((message) => message.authorKind === 'assistant')

  assert.equal(initialCallCount, 1)
  assert.equal(restartCallCount, 1)
  assert.equal(waitRow?.status, 'timed_out')
  assert.equal(toolRow?.errorText, 'Wait timed out before external input arrived')
  assert.equal(runRow?.status, 'completed')
  assert.equal(assistantReply?.content[0]?.text, 'Startup timeout reconciliation resumed the run.')
  assert.equal(
    restartedRuntime.db
      .select()
      .from(domainEvents)
      .all()
      .some((event) => event.type === 'wait.timed_out'),
    true,
  )

  await closeAppRuntime(restartedRuntime)
})

test('timeout recovery interrupted after wait resolution resumes once on restart without duplicating timeout history', async () => {
  const harness = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { app, config, runtime } = harness
  const { headers } = seedApiKeyAuth(runtime)
  const timeoutAt = '2000-01-01T00:00:00.000Z'
  let initialCallCount = 0
  let restartCallCount = 0
  let simulatedCrash = false

  registerFunctionTool(runtime, {
    execute: async () =>
      ok({
        kind: 'waiting' as const,
        wait: {
          description: 'Waiting for upstream system',
          targetKind: 'external' as const,
          targetRef: 'job_timeout_restart_1',
          timeoutAt,
          type: 'tool' as const,
        },
      }),
    name: 'await_upstream_timeout_restart',
  })

  const bootstrap = await executeWaitBootstrap(app, headers)

  runtime.services.ai.interactions.generate = async () => {
    initialCallCount += 1

    return ok<AiInteractionResponse>({
      messages: [],
      model: 'gpt-5.4',
      output: [
        {
          arguments: {},
          argumentsJson: '{}',
          callId: 'call_timeout_restart_wait_1',
          name: 'await_upstream_timeout_restart',
          type: 'function_call',
        },
      ],
      outputText: '',
      provider: 'openai',
      providerRequestId: 'req_timeout_restart_wait_1',
      raw: { stub: true },
      responseId: 'resp_timeout_restart_wait_1',
      status: 'completed',
      toolCalls: [
        {
          arguments: {},
          argumentsJson: '{}',
          callId: 'call_timeout_restart_wait_1',
          name: 'await_upstream_timeout_restart',
        },
      ],
      usage: null,
    })
  }

  const execution = await executeRun(app, headers, bootstrap.data.runId)

  assert.equal(execution.response.status, 202)
  assert.equal(execution.body.data.status, 'waiting')

  const originalTransaction = runtime.db.transaction.bind(runtime.db)
  ;(
    runtime.db as unknown as {
      transaction: typeof runtime.db.transaction
    }
  ).transaction = ((callback: Parameters<typeof runtime.db.transaction>[0]) => {
    const result = originalTransaction(callback)
    const waitRow = runtime.db.select().from(runDependencies).get()

    if (!simulatedCrash && waitRow?.status === 'timed_out') {
      simulatedCrash = true
      throw new Error('Simulated crash after timeout resolution')
    }

    return result
  }) as typeof runtime.db.transaction

  try {
    const reconciled = await runtime.services.multiagent.reconcileDecisions({
      kinds: ['recover_timed_out_wait'],
      mode: 'startup',
    })
    assert.equal(reconciled.ok, false)
    if (reconciled.ok) {
      throw new Error('expected reconciliation to report the simulated crash')
    }
    assert.equal(reconciled.error.type, 'conflict')
    assert.match(reconciled.error.message, /Simulated crash after timeout resolution/)
  } finally {
    ;(
      runtime.db as unknown as {
        transaction: typeof runtime.db.transaction
      }
    ).transaction = originalTransaction
  }

  const midWait = runtime.db.select().from(runDependencies).get()
  const midTool = runtime.db.select().from(toolExecutions).get()
  const midRun = runtime.db.select().from(runs).where(eq(runs.id, bootstrap.data.runId)).get()
  const midEventTypes = runtime.db
    .select()
    .from(domainEvents)
    .all()
    .map((event) => event.type)

  assert.equal(simulatedCrash, true)
  assert.equal(initialCallCount, 1)
  assert.equal(midWait?.status, 'timed_out')
  assert.equal(midTool?.errorText, 'Wait timed out before external input arrived')
  assert.equal(midRun?.status, 'waiting')
  assert.equal(midEventTypes.filter((type) => type === 'wait.timed_out').length, 1)
  assert.equal(midEventTypes.filter((type) => type === 'tool.failed').length, 1)
  assert.equal(midEventTypes.filter((type) => type === 'run.resumed').length, 0)

  await closeAppRuntime(runtime)

  const restartedRuntime = createAppRuntime(config)
  restartedRuntime.services.ai.interactions.generate = async () => {
    restartCallCount += 1
    return ok(buildAssistantResponse('Restart completed after the timeout recovery crash.'))
  }
  wireStreamingStub(restartedRuntime)

  await initializeAppRuntime(restartedRuntime)
  await drainWorker(restartedRuntime)

  const finalWait = restartedRuntime.db.select().from(runDependencies).get()
  const finalRun = restartedRuntime.db
    .select()
    .from(runs)
    .where(eq(runs.id, bootstrap.data.runId))
    .get()
  const assistantReply = restartedRuntime.db
    .select()
    .from(sessionMessages)
    .where(eq(sessionMessages.runId, bootstrap.data.runId))
    .all()
    .find((message) => message.authorKind === 'assistant')
  const finalEventTypes = restartedRuntime.db
    .select()
    .from(domainEvents)
    .all()
    .map((event) => event.type)

  assert.equal(restartCallCount, 1)
  assert.equal(finalWait?.status, 'timed_out')
  assert.equal(finalRun?.status, 'completed')
  assert.equal(
    assistantReply?.content[0]?.text,
    'Restart completed after the timeout recovery crash.',
  )
  assert.equal(finalEventTypes.filter((type) => type === 'wait.timed_out').length, 1)
  assert.equal(finalEventTypes.filter((type) => type === 'tool.failed').length, 1)
  assert.equal(finalEventTypes.filter((type) => type === 'run.resumed').length, 1)

  await closeAppRuntime(restartedRuntime)
})

const executeWaitBootstrap = (
  app: ReturnType<typeof createTestHarness>['app'],
  headers: Record<string, string>,
) => bootstrapPlannerRun(app, headers)
