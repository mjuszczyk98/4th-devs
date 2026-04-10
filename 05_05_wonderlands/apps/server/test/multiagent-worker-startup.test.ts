import {
  assert,
  asAccountId,
  asRunId,
  asTenantId,
  bootstrapPlannerRun,
  bootstrapSession,
  buildAssistantResponse,
  buildDelegateResponse,
  closeAppRuntime,
  createAppRuntime,
  createExecuteRunCommand,
  createInternalCommandContext,
  createResumeRunCommand,
  createStartThreadInteractionCommand,
  createTestHarness,
  domainEvents,
  drainWorker,
  eq,
  executeRun,
  initializeAppRuntime,
  jobs,
  ok,
  runs,
  seedActiveAgent,
  seedApiKeyAuth,
  seedSubagentLink,
  sessionMessages,
  test,
  wireStreamingStub,
  runDependencies,
} from './helpers/multiagent-worker'
import type { AiInteractionRequest } from './helpers/multiagent-worker'

test('child delivery leaves parent reopen/resume to the readiness engine when dependency waits are satisfied', async () => {
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
    if (request.metadata?.runId === rootRunId && rootCallCount === 0) {
      rootCallCount += 1
      return ok(
        buildDelegateResponse({
          task: 'Resolve the child dependency before resuming the parent',
        }),
      )
    }

    if (request.metadata?.runId !== rootRunId) {
      return ok(buildAssistantResponse('Child dependency completed.'))
    }

    return ok(buildAssistantResponse('Parent resumed after graph reopen.'))
  }

  const executeResult = await executeRun(app, headers, rootRunId)

  assert.equal(executeResult.response.status, 202)

  const childRunId = runtime.db
    .select()
    .from(runs)
    .all()
    .find((run) => run.id !== rootRunId)?.id

  assert.ok(childRunId)

  const childExecution = await createExecuteRunCommand().execute(
    createInternalCommandContext(runtime, {
      accountId: asAccountId(accountId),
      role: 'admin',
      tenantId: asTenantId(tenantId),
    }),
    asRunId(childRunId),
    {},
  )

  assert.equal(
    childExecution.ok,
    true,
    childExecution.ok ? undefined : childExecution.error.message,
  )

  const delivered = await runtime.services.multiagent.reconcileDecisions({
    kinds: ['deliver_resolved_child_result'],
    mode: 'startup',
  })
  assert.equal(delivered.ok, true, delivered.ok ? undefined : delivered.error.message)
  assert.equal(delivered.value, 1)

  const waitingParentWorkItem = runtime.db
    .select()
    .from(jobs)
    .all()
    .find((workItem) => workItem.currentRunId === rootRunId)
  const resolvedWait = runtime.db.select().from(runDependencies).get()
  const midEventTypes = runtime.db
    .select()
    .from(domainEvents)
    .all()
    .map((event) => event.type)

  assert.equal(resolvedWait?.status, 'resolved')
  assert.equal(waitingParentWorkItem?.status, 'waiting')
  assert.equal(midEventTypes.filter((type) => type === 'job.requeued').length, 0)

  const reopened = await runtime.services.multiagent.reconcileDecisions({
    kinds: ['requeue_waiting_job'],
    mode: 'startup',
  })
  assert.equal(reopened.ok, true, reopened.ok ? undefined : reopened.error.message)
  assert.equal(reopened.value, 1)

  const reopenedParentWorkItem = runtime.db
    .select()
    .from(jobs)
    .all()
    .find((workItem) => workItem.currentRunId === rootRunId)
  const eventTypes = runtime.db
    .select()
    .from(domainEvents)
    .all()
    .map((event) => event.type)

  assert.equal(reopenedParentWorkItem?.status, 'queued')
  assert.equal(eventTypes.includes('job.requeued'), true)

  const recoverableWaitingRuns = await runtime.services.multiagent.reconcileDecisions({
    kinds: ['resume_waiting_run'],
    mode: 'startup',
  })
  assert.equal(
    recoverableWaitingRuns.ok,
    true,
    recoverableWaitingRuns.ok ? undefined : recoverableWaitingRuns.error.message,
  )
  assert.equal(recoverableWaitingRuns.value, 1)
})

test('worker executes pending bootstrap root runs without an explicit execute request', async () => {
  const { app, runtime } = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { headers } = seedApiKeyAuth(runtime)
  const bootstrap = await bootstrapPlannerRun(app, headers)

  runtime.services.ai.interactions.generate = async () =>
    ok(buildAssistantResponse('Bootstrap run was recovered by the worker.'))

  const pendingBootstrapRun = runtime.db
    .select()
    .from(runs)
    .where(eq(runs.id, bootstrap.data.runId))
    .get()
  const pendingBootstrapWorkItem = runtime.db
    .select()
    .from(jobs)
    .all()
    .find((workItem) => workItem.currentRunId === bootstrap.data.runId)
  const bootstrapReason = pendingBootstrapWorkItem?.statusReasonJson as
    | {
        reason?: string
        runId?: string
        source?: string
      }
    | null
    | undefined

  assert.equal(pendingBootstrapRun?.status, 'pending')
  assert.equal(bootstrapReason?.reason, 'session.bootstrap')
  assert.equal(bootstrapReason?.runId, bootstrap.data.runId)
  assert.equal(bootstrapReason?.source, 'session.bootstrap')

  await drainWorker(runtime)

  const completedBootstrapRun = runtime.db
    .select()
    .from(runs)
    .where(eq(runs.id, bootstrap.data.runId))
    .get()
  const assistantReply = runtime.db
    .select()
    .from(sessionMessages)
    .where(eq(sessionMessages.runId, bootstrap.data.runId))
    .all()
    .find((message) => message.authorKind === 'assistant')

  assert.equal(completedBootstrapRun?.status, 'completed')
  assert.equal(assistantReply?.content[0]?.text, 'Bootstrap run was recovered by the worker.')

  await closeAppRuntime(runtime)
})

test('runtime startup reconciliation executes interrupted bootstrap root runs after restart', async () => {
  const harness = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { app, config, runtime } = harness
  const { headers } = seedApiKeyAuth(runtime)
  const bootstrap = await bootstrapPlannerRun(app, headers)

  await closeAppRuntime(runtime)

  const restartedRuntime = createAppRuntime(config)
  restartedRuntime.services.ai.interactions.generate = async () =>
    ok(buildAssistantResponse('Bootstrap run resumed after restart.'))
  wireStreamingStub(restartedRuntime)

  await initializeAppRuntime(restartedRuntime)
  await drainWorker(restartedRuntime)

  const recoveredRun = restartedRuntime.db
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

  assert.equal(recoveredRun?.status, 'completed')
  assert.equal(assistantReply?.content[0]?.text, 'Bootstrap run resumed after restart.')

  await closeAppRuntime(restartedRuntime)
})

test('execute run rebuilds durable output when the worker already completed a bootstrap run first', async () => {
  const { app, runtime } = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { headers } = seedApiKeyAuth(runtime)
  const bootstrap = await bootstrapPlannerRun(app, headers)

  runtime.services.ai.interactions.generate = async () =>
    ok(buildAssistantResponse('Bootstrap run completed before explicit execute.'))

  await drainWorker(runtime)

  const execution = await executeRun(app, headers, bootstrap.data.runId)

  assert.equal(execution.response.status, 200)
  assert.equal(execution.body.data.runId, bootstrap.data.runId)
  assert.equal(execution.body.data.status, 'completed')
  assert.equal(execution.body.data.outputText, 'Bootstrap run completed before explicit execute.')

  await closeAppRuntime(runtime)
})

test('worker executes pending root runs left behind after thread interaction creation is interrupted', async () => {
  const { app, runtime } = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { accountId, headers, tenantId } = seedApiKeyAuth(runtime)
  const bootstrap = await bootstrapPlannerRun(app, headers)
  const startThreadInteractionCommand = createStartThreadInteractionCommand()
  let generationCount = 0

  runtime.services.ai.interactions.generate = async (request: AiInteractionRequest) => {
    generationCount += 1

    if (request.metadata?.runId === bootstrap.data.runId) {
      return ok(buildAssistantResponse('Initial bootstrap run completed.'))
    }

    return ok(buildAssistantResponse('Interrupted interaction run was recovered by the worker.'))
  }

  const initialExecution = await executeRun(app, headers, bootstrap.data.runId)

  assert.equal(initialExecution.response.status, 200)

  const commandContext = createInternalCommandContext(runtime, {
    accountId: asAccountId(accountId),
    role: 'admin',
    tenantId: asTenantId(tenantId),
  })
  const startedInteraction = startThreadInteractionCommand.execute(
    commandContext,
    bootstrap.data.threadId,
    {
      text: 'Recover this interrupted interaction',
    },
  )

  assert.ok(startedInteraction.ok)

  const pendingInteractionRun = runtime.db
    .select()
    .from(runs)
    .where(eq(runs.id, startedInteraction.value.runId))
    .get()
  const pendingInteractionWorkItem = runtime.db
    .select()
    .from(jobs)
    .all()
    .find((workItem) => workItem.currentRunId === startedInteraction.value.runId)

  assert.equal(pendingInteractionRun?.status, 'pending')
  assert.equal(pendingInteractionRun?.resultJson, null)
  const interactionReason = pendingInteractionWorkItem?.statusReasonJson as
    | {
        inputMessageId?: string
        reason?: string
        runId?: string
        source?: string
      }
    | null
    | undefined

  assert.equal(interactionReason?.inputMessageId, startedInteraction.value.messageId)
  assert.equal(interactionReason?.reason, 'thread.interaction')
  assert.equal(interactionReason?.runId, startedInteraction.value.runId)
  assert.equal(interactionReason?.source, 'thread.interaction')

  await drainWorker(runtime)

  const completedInteractionRun = runtime.db
    .select()
    .from(runs)
    .where(eq(runs.id, startedInteraction.value.runId))
    .get()
  const assistantReply = runtime.db
    .select()
    .from(sessionMessages)
    .where(eq(sessionMessages.runId, startedInteraction.value.runId))
    .all()
    .find((message) => message.authorKind === 'assistant')

  assert.equal(generationCount, 2)
  assert.equal(completedInteractionRun?.status, 'completed')
  assert.equal(
    assistantReply?.content[0]?.text,
    'Interrupted interaction run was recovered by the worker.',
  )

  await closeAppRuntime(runtime)
})

test('runtime startup reconciliation executes interrupted thread interaction runs after restart', async () => {
  const harness = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { app, config, runtime } = harness
  const { accountId, headers, tenantId } = seedApiKeyAuth(runtime)
  const bootstrap = await bootstrapPlannerRun(app, headers)
  const startThreadInteractionCommand = createStartThreadInteractionCommand()

  runtime.services.ai.interactions.generate = async () =>
    ok(buildAssistantResponse('Initial bootstrap run completed.'))

  const initialExecution = await executeRun(app, headers, bootstrap.data.runId)

  assert.equal(initialExecution.response.status, 200)

  const commandContext = createInternalCommandContext(runtime, {
    accountId: asAccountId(accountId),
    role: 'admin',
    tenantId: asTenantId(tenantId),
  })
  const startedInteraction = startThreadInteractionCommand.execute(
    commandContext,
    bootstrap.data.threadId,
    {
      text: 'Recover this interaction after restart',
    },
  )

  assert.ok(startedInteraction.ok)

  await closeAppRuntime(runtime)

  const restartedRuntime = createAppRuntime(config)
  restartedRuntime.services.ai.interactions.generate = async () =>
    ok(buildAssistantResponse('Interrupted interaction run resumed after restart.'))
  wireStreamingStub(restartedRuntime)

  await initializeAppRuntime(restartedRuntime)
  await drainWorker(restartedRuntime)

  const recoveredRun = restartedRuntime.db
    .select()
    .from(runs)
    .where(eq(runs.id, startedInteraction.value.runId))
    .get()
  const assistantReply = restartedRuntime.db
    .select()
    .from(sessionMessages)
    .where(eq(sessionMessages.runId, startedInteraction.value.runId))
    .all()
    .find((message) => message.authorKind === 'assistant')

  assert.equal(recoveredRun?.status, 'completed')
  assert.equal(
    assistantReply?.content[0]?.text,
    'Interrupted interaction run resumed after restart.',
  )

  await closeAppRuntime(restartedRuntime)
})

test('repeated parent resume attempts resolve an agent wait once and append one child completion event', async () => {
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
          task: 'Research the migration fix',
        }),
      )
    }

    if (runId !== rootRunId) {
      return ok(buildAssistantResponse('Use additive migrations.'))
    }

    return ok(buildAssistantResponse('Parent resumed exactly once.'))
  }

  const executeResult = await executeRun(app, headers, rootRunId)

  assert.equal(executeResult.response.status, 202)

  const childRunId = runtime.db
    .select()
    .from(runs)
    .all()
    .find((run) => run.id !== rootRunId)?.id
  const waitId = runtime.db.select().from(runDependencies).get()?.id

  assert.ok(childRunId)
  assert.ok(waitId)

  const scope = {
    accountId: asAccountId(accountId),
    role: 'admin' as const,
    tenantId: asTenantId(tenantId),
  }
  const context = createInternalCommandContext(runtime, scope)

  const childExecution = await createExecuteRunCommand().execute(context, asRunId(childRunId), {})

  assert.equal(childExecution.ok, true)

  const resumeCommand = createResumeRunCommand()
  const childResult = {
    childRunId,
    kind: 'completed' as const,
    result: {
      outputText: 'Use additive migrations.',
    },
    summary: 'Use additive migrations.',
  }

  const [firstResume, secondResume] = await Promise.all([
    resumeCommand.execute(context, asRunId(rootRunId), {
      output: childResult,
      waitId,
    }),
    resumeCommand.execute(context, asRunId(rootRunId), {
      output: childResult,
      waitId,
    }),
  ])

  const successfulResumes = [firstResume, secondResume].filter((result) => result.ok)
  const failedResumes = [firstResume, secondResume].filter((result) => !result.ok)

  await drainWorker(runtime)

  assert.equal(successfulResumes.length, 1)
  assert.equal(failedResumes.length, 1)
  assert.equal(failedResumes[0]?.error.type, 'conflict')
  assert.equal(
    runtime.db
      .select()
      .from(domainEvents)
      .all()
      .filter((event) => event.type === 'run.resumed').length,
    1,
  )
  assert.equal(
    runtime.db
      .select()
      .from(domainEvents)
      .all()
      .filter((event) => event.type === 'child_run.completed').length,
    1,
  )
})
