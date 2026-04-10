import {
  assert,
  asAccountId,
  asRunId,
  asTenantId,
  bootstrapSession,
  buildAssistantResponse,
  buildDelegateResponse,
  buildReasoningAssistantResponse,
  buildReasoningDelegateResponse,
  cancelRun,
  closeAppRuntime,
  createAppRuntime,
  createExecuteRunCommand,
  createInternalCommandContext,
  createTestHarness,
  domainEvents,
  drainWorker,
  eq,
  err,
  executeRun,
  initializeAppRuntime,
  items,
  ok,
  runs,
  seedActiveAgent,
  seedApiKeyAuth,
  seedSubagentLink,
  sessionMessages,
  test,
  toolExecutions,
  wireStreamingStub,
  runDependencies,
} from './helpers/multiagent-worker'
import type { AiInteractionRequest } from './helpers/multiagent-worker'

test('worker falls back to child assistant message text when the child provider omits outputText', async () => {
  const { app, runtime } = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { accountId, headers, tenantId } = seedApiKeyAuth(runtime)

  seedActiveAgent(runtime, {
    accountId,
    agentId: 'agt_orchestrator',
    modelAlias: 'gpt-5.4',
    name: 'Orchestrator',
    nativeTools: ['delegate_to_agent'],
    profile: 'orchestrator',
    provider: 'openai',
    revisionId: 'agr_orchestrator_v1',
    slug: 'orchestrator',
    tenantId,
  })
  seedActiveAgent(runtime, {
    accountId,
    agentId: 'agt_researcher',
    modelAlias: 'gpt-5.4',
    name: 'Researcher',
    profile: 'research',
    provider: 'openai',
    revisionId: 'agr_researcher_v1',
    slug: 'researcher',
    tenantId,
  })
  seedSubagentLink(runtime, {
    alias: 'researcher',
    childAgentId: 'agt_researcher',
    id: 'asl_orchestrator_researcher',
    parentAgentRevisionId: 'agr_orchestrator_v1',
    tenantId,
  })

  const bootstrap = await bootstrapSession(app, headers, 'agt_orchestrator')
  const rootRunId = bootstrap.data.runId
  const childAssistantText = 'Jenny is doing well and ready to help.'
  let rootCallCount = 0
  let resumedParentRequest: AiInteractionRequest | null = null

  runtime.services.ai.interactions.generate = async (request: AiInteractionRequest) => {
    const runId = request.metadata?.runId

    if (runId === rootRunId && rootCallCount === 0) {
      rootCallCount += 1
      return ok(
        buildDelegateResponse({
          task: 'Ask Jenny how she is.',
        }),
      )
    }

    if (runId !== rootRunId) {
      return ok(buildAssistantResponse(childAssistantText, ''))
    }

    resumedParentRequest = request
    return ok(buildAssistantResponse('Jenny says she is doing well and ready to help.'))
  }

  const executeResult = await executeRun(app, headers, rootRunId)

  assert.equal(executeResult.response.status, 202)
  await drainWorker(runtime)

  const runRows = runtime.db.select().from(runs).all()
  const rootRun = runRows.find((run) => run.id === rootRunId)
  const childRun = runRows.find((run) => run.id !== rootRunId)
  const parentToolOutput = runtime.db
    .select()
    .from(items)
    .all()
    .find((item) => item.runId === rootRunId && item.type === 'function_call_output')
  const rootAssistantMessage = runtime.db
    .select()
    .from(sessionMessages)
    .all()
    .find((message) => message.runId === rootRunId && message.authorKind === 'assistant')

  assert.equal(rootRun?.status, 'completed')
  assert.equal(childRun?.status, 'completed')
  assert.equal(
    (childRun?.resultJson as { outputText?: string } | null | undefined)?.outputText,
    childAssistantText,
  )
  assert.match(
    String(parentToolOutput?.output),
    /"summary":"Jenny is doing well and ready to help\."/,
  )
  assert.equal(String(parentToolOutput?.output).includes('childRunId'), false)
  assert.equal(String(parentToolOutput?.output).includes('providerRequestId'), false)
  assert.equal(String(parentToolOutput?.output).includes('responseId'), false)
  assert.ok(resumedParentRequest)
  const resumedParentTranscript = JSON.stringify(resumedParentRequest?.messages)
  assert.match(resumedParentTranscript, /Jenny is doing well and ready to help\./)
  assert.equal(resumedParentTranscript.includes('"childRunId":"run_'), false)
  assert.equal(resumedParentTranscript.includes('providerRequestId'), false)
  assert.equal(resumedParentTranscript.includes('assistantMessageId'), false)
  assert.deepEqual(rootAssistantMessage?.content, [
    { text: 'Jenny says she is doing well and ready to help.', type: 'text' },
  ])
})

test('worker executes a pending child run, delivers its result, and auto-resumes the waiting parent', async () => {
  const { app, runtime } = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { accountId, headers, tenantId } = seedApiKeyAuth(runtime)

  seedActiveAgent(runtime, {
    accountId,
    agentId: 'agt_orchestrator',
    modelAlias: 'gpt-5.4',
    name: 'Orchestrator',
    nativeTools: ['delegate_to_agent'],
    profile: 'orchestrator',
    provider: 'openai',
    revisionId: 'agr_orchestrator_v1',
    slug: 'orchestrator',
    tenantId,
  })
  seedActiveAgent(runtime, {
    accountId,
    agentId: 'agt_researcher',
    modelAlias: 'gpt-5.4',
    name: 'Researcher',
    profile: 'research',
    provider: 'openai',
    revisionId: 'agr_researcher_v1',
    slug: 'researcher',
    tenantId,
  })
  seedSubagentLink(runtime, {
    alias: 'researcher',
    childAgentId: 'agt_researcher',
    id: 'asl_orchestrator_researcher',
    parentAgentRevisionId: 'agr_orchestrator_v1',
    tenantId,
  })

  const bootstrap = await bootstrapSession(app, headers, 'agt_orchestrator')
  const rootRunId = bootstrap.data.runId
  let rootCallCount = 0

  runtime.services.ai.interactions.generate = async (request: AiInteractionRequest) => {
    const runId = request.metadata?.runId

    if (runId === rootRunId && rootCallCount === 0) {
      rootCallCount += 1
      return ok(
        buildDelegateResponse({
          instructions: 'Research the additive SQLite migration strategy.',
          task: 'Research SQLite migrations',
        }),
      )
    }

    if (runId !== rootRunId) {
      const rootRunBeforeChildStart = runtime.db
        .select()
        .from(runs)
        .where(eq(runs.id, rootRunId))
        .get()

      assert.equal(rootRunBeforeChildStart?.status, 'waiting')
      return ok(
        buildAssistantResponse(
          'Use additive columns and tenant-safe triggers instead of table rebuilds.',
        ),
      )
    }

    assert.equal(request.messages.at(-1)?.role, 'tool')
    return ok(
      buildAssistantResponse(
        'We should keep additive migrations and avoid destructive SQLite table rebuilds.',
      ),
    )
  }

  const executeResult = await executeRun(app, headers, rootRunId)

  assert.equal(executeResult.response.status, 202)
  await drainWorker(runtime)

  const runRows = runtime.db.select().from(runs).all()
  const rootRun = runRows.find((run) => run.id === rootRunId)
  const childRun = runRows.find((run) => run.id !== rootRunId)
  const parentToolOutput = runtime.db
    .select()
    .from(items)
    .all()
    .find((item) => item.runId === rootRunId && item.type === 'function_call_output')

  assert.equal(rootRun?.status, 'completed')
  assert.equal(childRun?.status, 'completed')
  assert.equal(runtime.db.select().from(runDependencies).get()?.status, 'resolved')
  assert.equal(
    runtime.db
      .select()
      .from(sessionMessages)
      .all()
      .filter((message) => message.runId === childRun?.id).length,
    0,
  )
  assert.match(String(parentToolOutput?.output), /"kind":"completed"/)
  assert.match(
    String(parentToolOutput?.output),
    /"summary":"Use additive columns and tenant-safe triggers instead of table rebuilds\."/,
  )
  assert.equal(String(parentToolOutput?.output).includes('childRunId'), false)
  assert.equal(
    runtime.db
      .select()
      .from(domainEvents)
      .all()
      .some((event) => event.type === 'child_run.completed'),
    true,
  )
})

test('worker persists recursive delegated child transcript blocks on the parent assistant message', async () => {
  const { app, runtime } = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { accountId, headers, tenantId } = seedApiKeyAuth(runtime)

  seedActiveAgent(runtime, {
    accountId,
    agentId: 'agt_orchestrator',
    modelAlias: 'gpt-5.4',
    name: 'Orchestrator',
    nativeTools: ['delegate_to_agent'],
    profile: 'orchestrator',
    provider: 'openai',
    revisionId: 'agr_orchestrator_v1',
    slug: 'orchestrator',
    tenantId,
  })
  seedActiveAgent(runtime, {
    accountId,
    agentId: 'agt_researcher',
    modelAlias: 'gpt-5.4',
    name: 'Researcher',
    nativeTools: ['delegate_to_agent'],
    profile: 'research',
    provider: 'openai',
    revisionId: 'agr_researcher_v1',
    slug: 'researcher',
    tenantId,
  })
  seedActiveAgent(runtime, {
    accountId,
    agentId: 'agt_analyst',
    modelAlias: 'gpt-5.4',
    name: 'Analyst',
    profile: 'analysis',
    provider: 'openai',
    revisionId: 'agr_analyst_v1',
    slug: 'analyst',
    tenantId,
  })
  seedSubagentLink(runtime, {
    alias: 'researcher',
    childAgentId: 'agt_researcher',
    id: 'asl_orchestrator_researcher',
    parentAgentRevisionId: 'agr_orchestrator_v1',
    tenantId,
  })
  seedSubagentLink(runtime, {
    alias: 'analyst',
    childAgentId: 'agt_analyst',
    id: 'asl_researcher_analyst',
    parentAgentRevisionId: 'agr_researcher_v1',
    tenantId,
  })

  const bootstrap = await bootstrapSession(app, headers, 'agt_orchestrator')
  const rootRunId = bootstrap.data.runId
  const invocationCounts = new Map<string, number>()
  const grandchildWebSearch = {
    id: 'web_search:resp_recursive_child_1',
    patterns: ['sqlite migration'],
    provider: 'openai' as const,
    queries: ['sqlite additive migrations official guidance'],
    references: [
      {
        domain: 'sqlite.org',
        title: 'SQLite ALTER TABLE',
        url: 'https://sqlite.org/lang_altertable.html',
      },
    ],
    responseId: 'resp_recursive_child_1',
    status: 'completed' as const,
    targetUrls: ['https://sqlite.org/lang_altertable.html'],
  }

  runtime.services.ai.interactions.generate = async (request: AiInteractionRequest) => {
    const runId = String(request.metadata?.runId)
    const invocationCount = invocationCounts.get(runId) ?? 0
    invocationCounts.set(runId, invocationCount + 1)

    const runRows = runtime.db.select().from(runs).all()
    const childRun = runRows.find((candidate) => candidate.parentRunId === rootRunId)
    const grandchildRun = childRun
      ? runRows.find((candidate) => candidate.parentRunId === childRun.id)
      : undefined

    if (runId === rootRunId && invocationCount === 0) {
      return ok(
        buildDelegateResponse({
          agentAlias: 'researcher',
          callId: 'call_delegate_root',
          task: 'Ask Researcher to validate the SQLite migration plan.',
        }),
      )
    }

    if (runId === rootRunId) {
      return ok(buildAssistantResponse('Researcher confirmed the additive migration plan.'))
    }

    if (childRun && runId === childRun.id && invocationCount === 0) {
      return ok(
        buildReasoningDelegateResponse({
          agentAlias: 'analyst',
          callId: 'call_delegate_child',
          reasoning: 'Need the analyst to verify the SQLite migration guidance before replying.',
          reasoningId: 'rs_child_delegate_1',
          task: 'Ask Analyst to confirm additive SQLite migrations.',
        }),
      )
    }

    if (childRun && runId === childRun.id) {
      return ok(
        buildAssistantResponse(
          'Analyst confirmed that additive SQLite migrations are the safe path here.',
        ),
      )
    }

    if (grandchildRun && runId === grandchildRun.id) {
      return ok(
        buildReasoningAssistantResponse({
          reasoning: 'Need one official SQLite source before finalizing the recommendation.',
          reasoningId: 'rs_grandchild_1',
          text: 'SQLite supports additive schema changes through ALTER TABLE operations.',
          webSearches: [grandchildWebSearch],
        }),
      )
    }

    throw new Error(`unexpected run id in recursive transcript test: ${runId}`)
  }

  const executeResult = await executeRun(app, headers, rootRunId)

  assert.equal(executeResult.response.status, 202)
  await drainWorker(runtime)

  const runRows = runtime.db.select().from(runs).all()
  const rootRun = runRows.find((candidate) => candidate.id === rootRunId)
  const childRun = runRows.find((candidate) => candidate.parentRunId === rootRunId)
  const grandchildRun = childRun
    ? runRows.find((candidate) => candidate.parentRunId === childRun.id)
    : undefined

  assert.equal(rootRun?.status, 'completed')
  assert.equal(childRun?.status, 'completed')
  assert.equal(grandchildRun?.status, 'completed')

  const rootAssistantMessage = runtime.db
    .select()
    .from(sessionMessages)
    .all()
    .find((message) => message.runId === rootRunId && message.authorKind === 'assistant')

  const transcriptBlocks = (
    rootAssistantMessage?.metadata as {
      transcript?: {
        blocks?: Array<Record<string, unknown>>
      }
    } | null
  )?.transcript?.blocks

  assert.equal(
    rootAssistantMessage?.content[0]?.text,
    'Researcher confirmed the additive migration plan.',
  )
  assert.ok(Array.isArray(transcriptBlocks))
  assert.equal(
    transcriptBlocks?.some(
      (block) =>
        block.type === 'tool_interaction' &&
        block.toolCallId === 'call_delegate_root' &&
        block.childRunId === childRun?.id,
    ),
    true,
  )
  assert.equal(
    transcriptBlocks?.some(
      (block) =>
        block.type === 'thinking' &&
        block.sourceRunId === childRun?.id &&
        block.content ===
          'Need the analyst to verify the SQLite migration guidance before replying.',
    ),
    true,
  )
  assert.equal(
    transcriptBlocks?.some(
      (block) =>
        block.type === 'tool_interaction' &&
        block.toolCallId === 'call_delegate_child' &&
        block.sourceRunId === childRun?.id &&
        block.childRunId === grandchildRun?.id,
    ),
    true,
  )
  assert.equal(
    transcriptBlocks?.some(
      (block) =>
        block.type === 'thinking' &&
        block.sourceRunId === grandchildRun?.id &&
        block.content === 'Need one official SQLite source before finalizing the recommendation.',
    ),
    true,
  )
  assert.equal(
    transcriptBlocks?.some(
      (block) =>
        block.type === 'web_search' &&
        block.sourceRunId === grandchildRun?.id &&
        Array.isArray(block.queries) &&
        block.queries.includes('sqlite additive migrations official guidance'),
    ),
    true,
  )
  assert.equal(
    transcriptBlocks?.some(
      (block) =>
        block.type === 'text' &&
        block.sourceRunId === grandchildRun?.id &&
        block.content === 'SQLite supports additive schema changes through ALTER TABLE operations.',
    ),
    true,
  )
  assert.equal(
    transcriptBlocks?.some(
      (block) =>
        block.type === 'text' &&
        block.sourceRunId === childRun?.id &&
        block.content ===
          'Analyst confirmed that additive SQLite migrations are the safe path here.',
    ),
    true,
  )
})

test('worker maps a failed child run into a structured envelope and resumes the parent once', async () => {
  const { app, runtime } = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { accountId, headers, tenantId } = seedApiKeyAuth(runtime)

  seedActiveAgent(runtime, {
    accountId,
    agentId: 'agt_orchestrator',
    modelAlias: 'gpt-5.4',
    name: 'Orchestrator',
    nativeTools: ['delegate_to_agent'],
    profile: 'orchestrator',
    provider: 'openai',
    revisionId: 'agr_orchestrator_v1',
    slug: 'orchestrator',
    tenantId,
  })
  seedActiveAgent(runtime, {
    accountId,
    agentId: 'agt_researcher',
    modelAlias: 'gpt-5.4',
    name: 'Researcher',
    profile: 'research',
    provider: 'openai',
    revisionId: 'agr_researcher_v1',
    slug: 'researcher',
    tenantId,
  })
  seedSubagentLink(runtime, {
    alias: 'researcher',
    childAgentId: 'agt_researcher',
    id: 'asl_orchestrator_researcher',
    parentAgentRevisionId: 'agr_orchestrator_v1',
    tenantId,
  })

  const bootstrap = await bootstrapSession(app, headers, 'agt_orchestrator')
  const rootRunId = bootstrap.data.runId
  let rootCallCount = 0

  runtime.services.ai.interactions.generate = async (request: AiInteractionRequest) => {
    const runId = request.metadata?.runId

    if (runId === rootRunId && rootCallCount === 0) {
      rootCallCount += 1
      return ok(
        buildDelegateResponse({
          task: 'Research the broken upstream provider',
        }),
      )
    }

    if (runId !== rootRunId) {
      return err({
        message: 'Upstream provider exploded',
        provider: 'openai',
        type: 'provider',
      })
    }

    return ok(
      buildAssistantResponse('The child failed, so I will surface the failure and stop here.'),
    )
  }

  const executeResult = await executeRun(app, headers, rootRunId)

  assert.equal(executeResult.response.status, 202)
  await drainWorker(runtime)

  const runRows = runtime.db.select().from(runs).all()
  const rootRun = runRows.find((run) => run.id === rootRunId)
  const childRun = runRows.find((run) => run.id !== rootRunId)
  const parentToolOutput = runtime.db
    .select()
    .from(items)
    .all()
    .find((item) => item.runId === rootRunId && item.type === 'function_call_output')

  assert.equal(rootRun?.status, 'completed')
  assert.equal(childRun?.status, 'failed')
  assert.match(String(parentToolOutput?.output), /"kind":"failed"/)
  assert.match(String(parentToolOutput?.output), /Upstream provider exploded/)
})

test('worker can deliver a previously completed child run after restart without duplicating parent delivery', async () => {
  const harness = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { app, config, runtime } = harness
  const { accountId, headers, tenantId } = seedApiKeyAuth(runtime)

  seedActiveAgent(runtime, {
    accountId,
    agentId: 'agt_orchestrator',
    modelAlias: 'gpt-5.4',
    name: 'Orchestrator',
    nativeTools: ['delegate_to_agent'],
    profile: 'orchestrator',
    provider: 'openai',
    revisionId: 'agr_orchestrator_v1',
    slug: 'orchestrator',
    tenantId,
  })
  seedActiveAgent(runtime, {
    accountId,
    agentId: 'agt_researcher',
    modelAlias: 'gpt-5.4',
    name: 'Researcher',
    profile: 'research',
    provider: 'openai',
    revisionId: 'agr_researcher_v1',
    slug: 'researcher',
    tenantId,
  })
  seedSubagentLink(runtime, {
    alias: 'researcher',
    childAgentId: 'agt_researcher',
    id: 'asl_orchestrator_researcher',
    parentAgentRevisionId: 'agr_orchestrator_v1',
    tenantId,
  })

  const bootstrap = await bootstrapSession(app, headers, 'agt_orchestrator')
  const rootRunId = bootstrap.data.runId

  runtime.services.ai.interactions.generate = async (request: AiInteractionRequest) => {
    const runId = request.metadata?.runId

    if (runId === rootRunId) {
      return ok(
        buildDelegateResponse({
          task: 'Research restart-safe delivery',
        }),
      )
    }

    return ok(buildAssistantResponse('The child completed before the worker delivered its result.'))
  }

  const executeResult = await executeRun(app, headers, rootRunId)

  assert.equal(executeResult.response.status, 202)

  const childRunId = runtime.db
    .select()
    .from(runs)
    .all()
    .find((run) => run.id !== rootRunId)?.id

  assert.ok(childRunId)

  const childScope = {
    accountId: accountId as ReturnType<typeof seedApiKeyAuth>['accountId'],
    role: 'admin' as const,
    tenantId: tenantId as ReturnType<typeof seedApiKeyAuth>['tenantId'],
  }
  const childExecution = await createExecuteRunCommand().execute(
    createInternalCommandContext(runtime, childScope),
    childRunId,
    {},
  )

  assert.equal(
    childExecution.ok,
    true,
    childExecution.ok ? undefined : childExecution.error.message,
  )
  assert.equal(runtime.db.select().from(runDependencies).get()?.status, 'pending')
  assert.equal(
    runtime.db
      .select()
      .from(items)
      .all()
      .filter((item) => item.runId === rootRunId && item.type === 'function_call_output').length,
    0,
  )

  await closeAppRuntime(runtime)

  const restartedRuntime = createAppRuntime(config)
  restartedRuntime.services.ai.interactions.generate = async () =>
    ok(buildAssistantResponse('The restarted worker delivered the child result exactly once.'))
  wireStreamingStub(restartedRuntime)

  await restartedRuntime.services.multiagent.processAvailableDecisions()
  await restartedRuntime.services.multiagent.processAvailableDecisions()

  const restartedParentOutputs = restartedRuntime.db
    .select()
    .from(items)
    .all()
    .filter((item) => item.runId === rootRunId && item.type === 'function_call_output')
  const restartedRootRun = restartedRuntime.db
    .select()
    .from(runs)
    .all()
    .find((run) => run.id === rootRunId)

  assert.equal(restartedRootRun?.status, 'completed')
  assert.equal(restartedParentOutputs.length, 1)

  await closeAppRuntime(restartedRuntime)
})

test('cancelling a parent run cascades to joined pending children', async () => {
  const { app, runtime } = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { accountId, headers, tenantId } = seedApiKeyAuth(runtime)

  seedActiveAgent(runtime, {
    accountId,
    agentId: 'agt_orchestrator',
    modelAlias: 'gpt-5.4',
    name: 'Orchestrator',
    nativeTools: ['delegate_to_agent'],
    profile: 'orchestrator',
    provider: 'openai',
    revisionId: 'agr_orchestrator_v1',
    slug: 'orchestrator',
    tenantId,
  })
  seedActiveAgent(runtime, {
    accountId,
    agentId: 'agt_researcher',
    modelAlias: 'gpt-5.4',
    name: 'Researcher',
    profile: 'research',
    provider: 'openai',
    revisionId: 'agr_researcher_v1',
    slug: 'researcher',
    tenantId,
  })
  seedSubagentLink(runtime, {
    alias: 'researcher',
    childAgentId: 'agt_researcher',
    id: 'asl_orchestrator_researcher',
    parentAgentRevisionId: 'agr_orchestrator_v1',
    tenantId,
  })

  const bootstrap = await bootstrapSession(app, headers, 'agt_orchestrator')
  const rootRunId = bootstrap.data.runId

  runtime.services.ai.interactions.generate = async () =>
    ok(
      buildDelegateResponse({
        task: 'Prepare the joined child run',
      }),
    )

  const executeResult = await executeRun(app, headers, rootRunId)

  assert.equal(executeResult.response.status, 202)

  const childRunId = runtime.db
    .select()
    .from(runs)
    .all()
    .find((run) => run.id !== rootRunId)?.id

  assert.ok(childRunId)

  const cancelResult = await cancelRun(app, headers, rootRunId)

  assert.equal(cancelResult.response.status, 200)

  const runRows = runtime.db.select().from(runs).all()
  const rootRun = runRows.find((run) => run.id === rootRunId)
  const childRun = runRows.find((run) => run.id === childRunId)

  assert.equal(rootRun?.status, 'cancelled')
  assert.equal(childRun?.status, 'cancelled')
  assert.equal(runtime.db.select().from(runDependencies).get()?.status, 'cancelled')
  assert.equal(runtime.db.select().from(toolExecutions).get()?.errorText, 'Run cancelled')
  assert.equal(
    runtime.db
      .select()
      .from(domainEvents)
      .all()
      .filter((event) => event.type === 'run.cancelled').length,
    2,
  )
})
