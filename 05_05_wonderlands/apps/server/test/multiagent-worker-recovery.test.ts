import {
  assert,
  asAccountId,
  asItemId,
  asRunId,
  asTenantId,
  bootstrapPlannerRun,
  bootstrapSession,
  buildAssistantResponse,
  buildDelegateResponse,
  buildReasoningDelegateResponse,
  closeAppRuntime,
  createAppRuntime,
  createExecuteRunCommand,
  createInternalCommandContext,
  createItemRepository,
  createRunClaimRepository,
  createRunDependencyRepository,
  createTestHarness,
  createToolExecutionRepository,
  domainEvents,
  drainWorker,
  eq,
  executeRun,
  initializeAppRuntime,
  items,
  jobs,
  ok,
  registerFunctionTool,
  runClaims,
  runDependencies,
  runs,
  seedActiveAgent,
  seedApiKeyAuth,
  seedSubagentLink,
  sessionMessages,
  test,
  wireStreamingStub,
} from './helpers/multiagent-worker'
import type { AiInteractionRequest, AiInteractionResponse } from './helpers/multiagent-worker'

test('run claims preserve ownership until expiry', async () => {
  const { app, runtime } = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { accountId, headers, tenantId } = seedApiKeyAuth(runtime)

  seedActiveAgent(runtime, {
    accountId,
    agentId: 'agt_planner',
    modelAlias: 'gpt-5.4',
    name: 'Planner',
    profile: 'planner',
    provider: 'openai',
    revisionId: 'agr_planner_v1',
    slug: 'planner',
    tenantId,
  })

  const rooted = await bootstrapSession(app, headers, 'agt_planner')
  const scope = {
    accountId: asAccountId(accountId),
    role: 'admin' as const,
    tenantId: asTenantId(tenantId),
  }
  const claimRepository = createRunClaimRepository(runtime.db)

  const firstClaim = claimRepository.claim(scope, {
    acquiredAt: '2026-03-30T06:00:00.000Z',
    expiresAt: '2026-03-30T06:00:10.000Z',
    renewedAt: '2026-03-30T06:00:00.000Z',
    runId: asRunId(rooted.data.runId),
    workerId: 'wrk_a',
  })

  assert.equal(firstClaim.ok, true)

  const conflictingClaim = claimRepository.claim(scope, {
    acquiredAt: '2026-03-30T06:00:05.000Z',
    expiresAt: '2026-03-30T06:00:15.000Z',
    renewedAt: '2026-03-30T06:00:05.000Z',
    runId: asRunId(rooted.data.runId),
    workerId: 'wrk_b',
  })

  assert.equal(conflictingClaim.ok, false)
  assert.equal(conflictingClaim.error.type, 'conflict')

  const renewedByOwner = claimRepository.heartbeatClaim(scope, {
    expiresAt: '2026-03-30T06:00:16.000Z',
    renewedAt: '2026-03-30T06:00:06.000Z',
    runId: asRunId(rooted.data.runId),
    workerId: 'wrk_a',
  })

  assert.equal(renewedByOwner.ok, true)
  assert.equal(renewedByOwner.value.expiresAt, '2026-03-30T06:00:16.000Z')

  const conflictingAfterHeartbeat = claimRepository.claim(scope, {
    acquiredAt: '2026-03-30T06:00:11.000Z',
    expiresAt: '2026-03-30T06:00:21.000Z',
    renewedAt: '2026-03-30T06:00:11.000Z',
    runId: asRunId(rooted.data.runId),
    workerId: 'wrk_b',
  })

  assert.equal(conflictingAfterHeartbeat.ok, false)
  assert.equal(conflictingAfterHeartbeat.error.type, 'conflict')

  const acquiredAfterExpiry = claimRepository.claim(scope, {
    acquiredAt: '2026-03-30T06:00:20.000Z',
    expiresAt: '2026-03-30T06:00:30.000Z',
    renewedAt: '2026-03-30T06:00:20.000Z',
    runId: asRunId(rooted.data.runId),
    workerId: 'wrk_b',
  })

  assert.equal(acquiredAfterExpiry.ok, true)
  assert.equal(acquiredAfterExpiry.value.workerId, 'wrk_b')
})

test('worker heartbeats the child run claim while execution is still in flight', async () => {
  const { app, runtime } = createTestHarness({
    AUTH_MODE: 'api_key',
    MULTIAGENT_LEASE_TTL_MS: '60',
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
          task: 'Hold the claim long enough to require a heartbeat',
        }),
      )
    }

    if (runId !== rootRunId) {
      await new Promise((resolve) => setTimeout(resolve, 120))
      return ok(buildAssistantResponse('The child finished after a claim heartbeat.'))
    }

    return ok(buildAssistantResponse('The parent resumed after the claim stayed owned.'))
  }

  const executeResult = await executeRun(app, headers, rootRunId)

  assert.equal(executeResult.response.status, 202)

  const childRunId = runtime.db
    .select()
    .from(runs)
    .all()
    .find((run) => run.id !== rootRunId)?.id

  assert.ok(childRunId)

  const scope = {
    accountId: asAccountId(accountId),
    role: 'admin' as const,
    tenantId: asTenantId(tenantId),
  }
  const claimRepository = createRunClaimRepository(runtime.db)
  const workerPass = runtime.services.multiagent.processAvailableDecisions()

  await new Promise((resolve) => setTimeout(resolve, 90))

  const conflictingClaim = claimRepository.claim(scope, {
    acquiredAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    renewedAt: new Date().toISOString(),
    runId: asRunId(childRunId),
    workerId: 'wrk_competing',
  })

  assert.equal(conflictingClaim.ok, false)
  assert.equal(conflictingClaim.error.type, 'conflict')

  const childWorkItem = runtime.db
    .select()
    .from(jobs)
    .all()
    .find((workItem) => workItem.currentRunId === childRunId)

  assert.equal(childWorkItem?.status, 'running')
  assert.ok(childWorkItem?.lastHeartbeatAt)
  assert.ok(childWorkItem?.nextSchedulerCheckAt)
  assert.equal(
    typeof childWorkItem?.lastHeartbeatAt === 'string' &&
      typeof childWorkItem?.nextSchedulerCheckAt === 'string' &&
      childWorkItem.nextSchedulerCheckAt > childWorkItem.lastHeartbeatAt,
    true,
  )

  await workerPass
  await drainWorker(runtime)
})

test('worker requeues stale running child runs after claim expiry and completes them on the next pass', async () => {
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
          task: 'Recover the stale child run',
        }),
      )
    }

    if (runId !== rootRunId) {
      return ok(buildAssistantResponse('The stale child run was recovered and executed.'))
    }

    return ok(buildAssistantResponse('The parent resumed after stale child recovery.'))
  }

  const executeResult = await executeRun(app, headers, rootRunId)

  assert.equal(executeResult.response.status, 202)

  const childRun = runtime.db
    .select()
    .from(runs)
    .all()
    .find((run) => run.id !== rootRunId)
  const childWorkItem = runtime.db
    .select()
    .from(jobs)
    .all()
    .find((workItem) => workItem.currentRunId === childRun?.id)

  assert.ok(childRun)
  assert.ok(childWorkItem)

  runtime.db
    .update(runs)
    .set({
      lastProgressAt: '2026-01-01T00:00:00.000Z',
      startedAt: '2026-01-01T00:00:00.000Z',
      status: 'running',
      updatedAt: '2026-01-01T00:00:00.000Z',
      version: childRun.version + 1,
    })
    .where(eq(runs.id, childRun.id))
    .run()
  runtime.db
    .update(jobs)
    .set({
      lastHeartbeatAt: '2026-01-01T00:00:00.000Z',
      nextSchedulerCheckAt: '2026-01-01T00:00:00.060Z',
      status: 'running',
      updatedAt: '2026-01-01T00:00:00.000Z',
      version: childWorkItem.version + 1,
    })
    .where(eq(jobs.id, childWorkItem.id))
    .run()

  runtime.db
    .insert(runClaims)
    .values({
      acquiredAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-01T00:00:30.000Z',
      renewedAt: '2026-01-01T00:00:00.000Z',
      runId: childRun.id,
      tenantId,
      workerId: 'wrk_stale',
    })
    .run()

  await drainWorker(runtime)

  const refreshedRuns = runtime.db.select().from(runs).all()
  const rootRun = refreshedRuns.find((run) => run.id === rootRunId)
  const refreshedChildRun = refreshedRuns.find((run) => run.id === childRun.id)

  assert.equal(rootRun?.status, 'completed')
  assert.equal(refreshedChildRun?.status, 'completed')
  assert.equal(refreshedChildRun?.staleRecoveryCount, 1)
  assert.equal(
    runtime.db
      .select()
      .from(domainEvents)
      .all()
      .some((event) => event.type === 'run.requeued'),
    true,
  )
})

test('runtime startup reconciliation requeues stale running child runs before worker execution resumes', async () => {
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
  let rootCallCount = 0

  runtime.services.ai.interactions.generate = async (request: AiInteractionRequest) => {
    const runId = request.metadata?.runId

    if (runId === rootRunId && rootCallCount === 0) {
      rootCallCount += 1
      return ok(
        buildDelegateResponse({
          task: 'Recover the startup-stale child run',
        }),
      )
    }

    if (runId !== rootRunId) {
      return ok(buildAssistantResponse('The startup-stale child run was recovered and executed.'))
    }

    return ok(buildAssistantResponse('The parent resumed after startup reconciliation.'))
  }

  const executeResult = await executeRun(app, headers, rootRunId)

  assert.equal(executeResult.response.status, 202)

  const childRun = runtime.db
    .select()
    .from(runs)
    .all()
    .find((run) => run.id !== rootRunId)
  const childWorkItem = runtime.db
    .select()
    .from(jobs)
    .all()
    .find((workItem) => workItem.currentRunId === childRun?.id)

  assert.ok(childRun)
  assert.ok(childWorkItem)

  runtime.db
    .update(runs)
    .set({
      lastProgressAt: '2026-01-01T00:00:00.000Z',
      startedAt: '2026-01-01T00:00:00.000Z',
      status: 'running',
      updatedAt: '2026-01-01T00:00:00.000Z',
      version: childRun.version + 1,
    })
    .where(eq(runs.id, childRun.id))
    .run()
  runtime.db
    .update(jobs)
    .set({
      lastHeartbeatAt: '2026-01-01T00:00:00.000Z',
      nextSchedulerCheckAt: '2026-01-01T00:00:00.060Z',
      status: 'running',
      updatedAt: '2026-01-01T00:00:00.000Z',
      version: childWorkItem.version + 1,
    })
    .where(eq(jobs.id, childWorkItem.id))
    .run()

  runtime.db
    .insert(runClaims)
    .values({
      acquiredAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-01T00:00:30.000Z',
      renewedAt: '2026-01-01T00:00:00.000Z',
      runId: childRun.id,
      tenantId,
      workerId: 'wrk_startup_stale',
    })
    .run()

  await closeAppRuntime(runtime)

  const restartedRuntime = createAppRuntime(config)
  restartedRuntime.services.ai.interactions.generate = async (request: AiInteractionRequest) => {
    const runId = request.metadata?.runId

    if (runId === rootRunId) {
      return ok(buildAssistantResponse('The parent resumed after startup reconciliation.'))
    }

    return ok(buildAssistantResponse('The startup-stale child run was recovered and executed.'))
  }
  wireStreamingStub(restartedRuntime)

  await initializeAppRuntime(restartedRuntime)

  const reconciledChildRun = restartedRuntime.db
    .select()
    .from(runs)
    .all()
    .find((run) => run.id === childRun.id)

  assert.equal(reconciledChildRun?.status, 'pending')
  assert.equal(
    restartedRuntime.db
      .select()
      .from(domainEvents)
      .all()
      .some((event) => event.type === 'run.requeued'),
    true,
  )

  await drainWorker(restartedRuntime)

  const finalRuns = restartedRuntime.db.select().from(runs).all()
  const finalRootRun = finalRuns.find((run) => run.id === rootRunId)
  const finalChildRun = finalRuns.find((run) => run.id === childRun.id)

  assert.equal(finalRootRun?.status, 'completed')
  assert.equal(finalChildRun?.status, 'completed')

  await closeAppRuntime(restartedRuntime)
})

test('worker requeues stale running root runs after claim expiry and completes them on the next pass', async () => {
  const { app, runtime } = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { headers } = seedApiKeyAuth(runtime)

  const bootstrap = await bootstrapPlannerRun(app, headers)
  const rootRunId = bootstrap.data.runId
  const initialRootRun = runtime.db.select().from(runs).where(eq(runs.id, rootRunId)).get()
  const rootJob = runtime.db
    .select()
    .from(jobs)
    .all()
    .find((workItem) => workItem.currentRunId === rootRunId)

  assert.ok(initialRootRun)
  assert.ok(rootJob)

  runtime.db
    .update(runs)
    .set({
      lastProgressAt: '2026-01-01T00:00:00.000Z',
      startedAt: '2026-01-01T00:00:00.000Z',
      status: 'running',
      updatedAt: '2026-01-01T00:00:00.000Z',
      version: initialRootRun.version + 1,
    })
    .where(eq(runs.id, rootRunId))
    .run()
  runtime.db
    .update(jobs)
    .set({
      lastHeartbeatAt: '2026-01-01T00:00:00.000Z',
      nextSchedulerCheckAt: '2026-01-01T00:00:00.060Z',
      status: 'running',
      updatedAt: '2026-01-01T00:00:00.000Z',
      version: rootJob.version + 1,
    })
    .where(eq(jobs.id, rootJob.id))
    .run()

  runtime.services.ai.interactions.generate = async () =>
    ok(buildAssistantResponse('The stale root run was recovered by the worker.'))

  await drainWorker(runtime)

  const finalRootRun = runtime.db.select().from(runs).where(eq(runs.id, rootRunId)).get()
  const assistantReply = runtime.db
    .select()
    .from(sessionMessages)
    .where(eq(sessionMessages.runId, rootRunId))
    .all()
    .find((message) => message.authorKind === 'assistant')
  const requeueEvents = runtime.db
    .select()
    .from(domainEvents)
    .all()
    .filter((event) => event.type === 'run.requeued')

  assert.equal(finalRootRun?.status, 'completed')
  assert.equal(finalRootRun?.staleRecoveryCount, 1)
  assert.equal(assistantReply?.content[0]?.text, 'The stale root run was recovered by the worker.')
  assert.equal(requeueEvents.length, 1)
  assert.deepEqual(requeueEvents[0]?.payload, {
    reason: 'claim_expired',
    recoveredFromStatus: 'running',
    runId: rootRunId,
    sessionId: bootstrap.data.sessionId,
    status: 'pending',
    threadId: bootstrap.data.threadId,
  })
})

test('worker delays repeated stale root run recovery until the configured backoff elapses', async () => {
  const { app, runtime } = createTestHarness({
    AUTH_MODE: 'api_key',
    MULTIAGENT_STALE_RECOVERY_BASE_DELAY_MS: '50',
    NODE_ENV: 'test',
  })
  const { headers } = seedApiKeyAuth(runtime)

  const bootstrap = await bootstrapPlannerRun(app, headers)
  const rootRunId = bootstrap.data.runId
  const initialRootRun = runtime.db.select().from(runs).where(eq(runs.id, rootRunId)).get()
  const rootJob = runtime.db
    .select()
    .from(jobs)
    .all()
    .find((workItem) => workItem.currentRunId === rootRunId)

  assert.ok(initialRootRun)
  assert.ok(rootJob)

  runtime.db
    .update(runs)
    .set({
      lastProgressAt: '2026-01-01T00:00:00.000Z',
      staleRecoveryCount: 1,
      startedAt: '2026-01-01T00:00:00.000Z',
      status: 'running',
      updatedAt: '2026-01-01T00:00:00.000Z',
      version: initialRootRun.version + 1,
    })
    .where(eq(runs.id, rootRunId))
    .run()
  runtime.db
    .update(jobs)
    .set({
      lastHeartbeatAt: '2026-01-01T00:00:00.000Z',
      nextSchedulerCheckAt: '2026-01-01T00:00:00.060Z',
      status: 'running',
      updatedAt: '2026-01-01T00:00:00.000Z',
      version: rootJob.version + 1,
    })
    .where(eq(jobs.id, rootJob.id))
    .run()

  runtime.services.ai.interactions.generate = async () =>
    ok(buildAssistantResponse('The delayed stale root run was recovered after backoff.'))

  const requeued = await runtime.services.multiagent.processOneDecision()
  assert.equal(requeued, true)

  const delayedRun = runtime.db.select().from(runs).where(eq(runs.id, rootRunId)).get()
  const delayedJob = runtime.db.select().from(jobs).where(eq(jobs.id, rootJob.id)).get()
  const immediateRetry = await runtime.services.multiagent.processOneDecision()
  const assistantBeforeDelay = runtime.db
    .select()
    .from(sessionMessages)
    .where(eq(sessionMessages.runId, rootRunId))
    .all()
    .find((message) => message.authorKind === 'assistant')

  assert.equal(delayedRun?.status, 'pending')
  assert.equal(delayedRun?.staleRecoveryCount, 2)
  assert.equal(delayedJob?.status, 'queued')
  assert.ok(delayedJob?.nextSchedulerCheckAt)
  assert.equal(immediateRetry, false)
  assert.equal(assistantBeforeDelay, undefined)

  await new Promise((resolve) => setTimeout(resolve, 70))

  const executed = await runtime.services.multiagent.processOneDecision()
  const finalRun = runtime.db.select().from(runs).where(eq(runs.id, rootRunId)).get()
  const assistantReply = runtime.db
    .select()
    .from(sessionMessages)
    .where(eq(sessionMessages.runId, rootRunId))
    .all()
    .find((message) => message.authorKind === 'assistant')

  assert.equal(executed, true)
  assert.equal(finalRun?.status, 'completed')
  assert.equal(
    assistantReply?.content[0]?.text,
    'The delayed stale root run was recovered after backoff.',
  )
})

test('worker fails a stale root run after the stale recovery limit is exhausted', async () => {
  const { app, runtime } = createTestHarness({
    AUTH_MODE: 'api_key',
    MULTIAGENT_MAX_STALE_RECOVERIES: '1',
    NODE_ENV: 'test',
  })
  const { headers } = seedApiKeyAuth(runtime)

  const bootstrap = await bootstrapPlannerRun(app, headers)
  const rootRunId = bootstrap.data.runId
  const initialRootRun = runtime.db.select().from(runs).where(eq(runs.id, rootRunId)).get()
  const rootJob = runtime.db
    .select()
    .from(jobs)
    .all()
    .find((workItem) => workItem.currentRunId === rootRunId)
  let generateCalls = 0

  assert.ok(initialRootRun)
  assert.ok(rootJob)

  runtime.db
    .update(runs)
    .set({
      lastProgressAt: '2026-01-01T00:00:00.000Z',
      staleRecoveryCount: 1,
      startedAt: '2026-01-01T00:00:00.000Z',
      status: 'running',
      updatedAt: '2026-01-01T00:00:00.000Z',
      version: initialRootRun.version + 1,
    })
    .where(eq(runs.id, rootRunId))
    .run()
  runtime.db
    .update(jobs)
    .set({
      lastHeartbeatAt: '2026-01-01T00:00:00.000Z',
      nextSchedulerCheckAt: '2026-01-01T00:00:00.060Z',
      status: 'running',
      updatedAt: '2026-01-01T00:00:00.000Z',
      version: rootJob.version + 1,
    })
    .where(eq(jobs.id, rootJob.id))
    .run()

  runtime.services.ai.interactions.generate = async () => {
    generateCalls += 1
    return ok(buildAssistantResponse('This response should never be generated.'))
  }

  const worked = await runtime.services.multiagent.processOneDecision()
  const failedRun = runtime.db.select().from(runs).where(eq(runs.id, rootRunId)).get()
  const blockedJob = runtime.db.select().from(jobs).where(eq(jobs.id, rootJob.id)).get()
  const requeueEvents = runtime.db
    .select()
    .from(domainEvents)
    .all()
    .filter((event) => event.type === 'run.requeued')
  const failedEvents = runtime.db
    .select()
    .from(domainEvents)
    .all()
    .filter((event) => event.type === 'run.failed')

  assert.equal(worked, true)
  assert.equal(generateCalls, 0)
  assert.equal(failedRun?.status, 'failed')
  assert.equal(
    (failedRun?.errorJson as { message?: string } | null | undefined)?.message,
    `run ${rootRunId} exceeded the configured maximum of 1 stale recovery attempts`,
  )
  assert.equal(blockedJob?.status, 'blocked')
  assert.equal(
    (
      blockedJob?.statusReasonJson as
        | { error?: { message?: string } | null }
        | null
        | undefined
    )?.error?.message,
    `run ${rootRunId} exceeded the configured maximum of 1 stale recovery attempts`,
  )
  assert.equal(requeueEvents.length, 0)
  assert.equal(failedEvents.length, 1)
})

test('runtime startup reconciliation requeues abandoned root runs and resumes them across repeated restarts', async () => {
  const harness = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { app, config, runtime } = harness
  const { headers } = seedApiKeyAuth(runtime)

  const bootstrap = await bootstrapPlannerRun(app, headers)
  const rootRunId = bootstrap.data.runId
  const rootJob = runtime.db
    .select()
    .from(jobs)
    .all()
    .find((workItem) => workItem.currentRunId === rootRunId)
  const initialRootRun = runtime.db.select().from(runs).where(eq(runs.id, rootRunId)).get()

  assert.ok(initialRootRun)
  assert.ok(rootJob)

  runtime.db
    .update(runs)
    .set({
      lastProgressAt: '2026-03-30T06:00:00.000Z',
      startedAt: '2026-01-01T00:00:00.000Z',
      status: 'running',
      updatedAt: '2026-03-30T06:00:00.000Z',
      version: initialRootRun.version + 1,
    })
    .where(eq(runs.id, rootRunId))
    .run()
  runtime.db
    .update(jobs)
    .set({
      lastHeartbeatAt: '2026-01-01T00:00:00.000Z',
      nextSchedulerCheckAt: '2026-01-01T00:00:00.060Z',
      status: 'running',
      updatedAt: '2026-01-01T00:00:00.000Z',
      version: rootJob.version + 1,
    })
    .where(eq(jobs.id, rootJob.id))
    .run()

  await closeAppRuntime(runtime)

  const firstRestart = createAppRuntime(config)
  firstRestart.services.ai.interactions.generate = async () =>
    ok(buildAssistantResponse('The abandoned root run resumed after restart.'))
  wireStreamingStub(firstRestart)

  await initializeAppRuntime(firstRestart)

  const requeuedRootRun = firstRestart.db.select().from(runs).where(eq(runs.id, rootRunId)).get()
  const requeuedRootJob = firstRestart.db
    .select()
    .from(jobs)
    .all()
    .find((workItem) => workItem.currentRunId === rootRunId)

  assert.equal(requeuedRootRun?.status, 'pending')
  assert.equal(requeuedRootRun?.resultJson, null)
  assert.equal(requeuedRootRun?.staleRecoveryCount, 0)
  assert.equal(
    (requeuedRootJob?.statusReasonJson as { reason?: string } | null)?.reason,
    'process_restarted',
  )
  assert.equal((requeuedRootJob?.statusReasonJson as { runId?: string } | null)?.runId, rootRunId)
  assert.equal(
    firstRestart.db
      .select()
      .from(domainEvents)
      .all()
      .some((event) => event.type === 'run.requeued'),
    true,
  )
  assert.equal(
    firstRestart.db.select().from(jobs).where(eq(jobs.id, rootJob.id)).get()?.status,
    'queued',
  )

  await closeAppRuntime(firstRestart)

  const secondRestart = createAppRuntime(config)
  secondRestart.services.ai.interactions.generate = async () =>
    ok(buildAssistantResponse('The abandoned root run resumed after restart.'))
  wireStreamingStub(secondRestart)

  await initializeAppRuntime(secondRestart)

  const pendingRecoveredRootRun = secondRestart.db
    .select()
    .from(runs)
    .where(eq(runs.id, rootRunId))
    .get()

  assert.equal(pendingRecoveredRootRun?.status, 'pending')

  await drainWorker(secondRestart)

  const completedRootRun = secondRestart.db.select().from(runs).where(eq(runs.id, rootRunId)).get()
  const assistantReply = secondRestart.db
    .select()
    .from(sessionMessages)
    .where(eq(sessionMessages.runId, rootRunId))
    .all()
    .find((message) => message.authorKind === 'assistant')

  assert.equal(completedRootRun?.status, 'completed')
  assert.equal(assistantReply?.content[0]?.text, 'The abandoned root run resumed after restart.')

  await closeAppRuntime(secondRestart)
})

test('runtime startup reconciliation resumes waiting runs whose last wait was already resolved', async () => {
  const harness = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { app, config, runtime } = harness
  const { accountId, headers, tenantId } = seedApiKeyAuth(runtime)
  const runIdToRecover = (await bootstrapPlannerRun(app, headers)).data.runId
  const resolvedToolOutput = {
    source: 'recovery_test',
    status: 'queued',
  }
  let generationCount = 0

  registerFunctionTool(runtime, {
    execute: async () =>
      ok({
        kind: 'waiting' as const,
        wait: {
          description: 'Waiting for recovered upstream work',
          targetKind: 'external' as const,
          targetRef: 'job_resume_1',
          type: 'tool' as const,
        },
      }),
    name: 'await_resume',
  })

  runtime.services.ai.interactions.generate = async () => {
    generationCount += 1

    if (generationCount === 1) {
      return ok<AiInteractionResponse>({
        messages: [],
        model: 'gpt-5.4',
        output: [
          {
            arguments: {},
            argumentsJson: '{}',
            callId: 'call_resume_wait_1',
            name: 'await_resume',
            type: 'function_call',
          },
        ],
        outputText: '',
        provider: 'openai',
        providerRequestId: 'req_resume_wait_1',
        raw: { stub: true },
        responseId: 'resp_resume_wait_1',
        status: 'completed',
        toolCalls: [
          {
            arguments: {},
            argumentsJson: '{}',
            callId: 'call_resume_wait_1',
            name: 'await_resume',
          },
        ],
        usage: null,
      })
    }

    return ok(buildAssistantResponse('Recovered waiting run resumed after restart.'))
  }

  const execution = await executeRun(app, headers, runIdToRecover)

  assert.equal(execution.response.status, 202)
  assert.equal(execution.body.data.status, 'waiting')

  const context = createInternalCommandContext(runtime, {
    accountId: asAccountId(accountId),
    role: 'admin',
    tenantId: asTenantId(tenantId),
  })
  const itemRepository = createItemRepository(runtime.db)
  const toolExecutionRepository = createToolExecutionRepository(runtime.db)
  const runDependencyRepository = createRunDependencyRepository(runtime.db)
  const runDependency = runDependencyRepository.listByRunId(
    context.tenantScope,
    asRunId(runIdToRecover),
  )

  assert.ok(runDependency.ok)
  assert.equal(runDependency.value.length, 1)

  const resolvedAt = '2026-03-30T14:00:00.000Z'
  const completedTool = toolExecutionRepository.complete(context.tenantScope, {
    completedAt: resolvedAt,
    durationMs: null,
    id: runDependency.value[0].callId,
    outcomeJson: resolvedToolOutput,
  })

  assert.ok(completedTool.ok)

  const nextSequence = itemRepository.getNextSequence(context.tenantScope, asRunId(runIdToRecover))

  assert.ok(nextSequence.ok)

  const outputItem = itemRepository.createFunctionCallOutput(context.tenantScope, {
    callId: runDependency.value[0].callId,
    createdAt: resolvedAt,
    id: asItemId(runtime.services.ids.create('itm')),
    output: JSON.stringify(resolvedToolOutput),
    providerPayload: {
      isError: false,
      name: 'await_resume',
    },
    runId: asRunId(runIdToRecover),
    sequence: nextSequence.value,
  })

  assert.ok(outputItem.ok)

  const resolvedWait = runDependencyRepository.resolve(context.tenantScope, {
    id: runDependency.value[0].id,
    resolutionJson: {
      output: resolvedToolOutput,
    },
    resolvedAt,
    status: 'resolved',
  })

  assert.ok(resolvedWait.ok)

  await closeAppRuntime(runtime)

  const restartedRuntime = createAppRuntime(config)
  restartedRuntime.services.ai.interactions.generate = async () => {
    generationCount += 1
    return ok(buildAssistantResponse('Recovered waiting run resumed after restart.'))
  }
  wireStreamingStub(restartedRuntime)

  await initializeAppRuntime(restartedRuntime)
  await drainWorker(restartedRuntime)

  const finalRun = restartedRuntime.db.select().from(runs).where(eq(runs.id, runIdToRecover)).get()
  const assistantReply = restartedRuntime.db
    .select()
    .from(sessionMessages)
    .where(eq(sessionMessages.runId, runIdToRecover))
    .all()
    .find((message) => message.authorKind === 'assistant')
  const resumedEvent = restartedRuntime.db
    .select()
    .from(domainEvents)
    .all()
    .find((event) => event.type === 'run.resumed')

  assert.equal(generationCount, 2)
  assert.equal(finalRun?.status, 'completed')
  assert.equal(restartedRuntime.db.select().from(runDependencies).get()?.status, 'resolved')
  assert.equal(assistantReply?.content[0]?.text, 'Recovered waiting run resumed after restart.')
  assert.equal(
    restartedRuntime.db
      .select()
      .from(domainEvents)
      .all()
      .some((event) => event.type === 'run.resumed'),
    true,
  )
  assert.equal(
    (resumedEvent?.payload as { reason?: unknown } | undefined)?.reason,
    'process_restarted',
  )

  await closeAppRuntime(restartedRuntime)
})

test('runtime startup reconciliation delivers completed child results before worker polling resumes', async () => {
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
  let initialRootCallCount = 0
  let restartedRootCallCount = 0

  runtime.services.ai.interactions.generate = async (request: AiInteractionRequest) => {
    const runId = request.metadata?.runId

    if (runId === rootRunId) {
      initialRootCallCount += 1
      return ok(
        buildDelegateResponse({
          task: 'Recover startup child delivery',
        }),
      )
    }

    return ok(buildAssistantResponse('The child finished before restart.'))
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
  restartedRuntime.services.ai.interactions.generate = async (request: AiInteractionRequest) => {
    if (request.metadata?.runId === rootRunId) {
      restartedRootCallCount += 1
      return ok(buildAssistantResponse('Startup child delivery reconciliation resumed the parent.'))
    }

    return ok(buildAssistantResponse('Unexpected child execution after restart.'))
  }
  wireStreamingStub(restartedRuntime)

  await initializeAppRuntime(restartedRuntime)

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
  const assistantReply = restartedRuntime.db
    .select()
    .from(sessionMessages)
    .where(eq(sessionMessages.runId, rootRunId))
    .all()
    .find((message) => message.authorKind === 'assistant')

  assert.equal(initialRootCallCount, 1)
  assert.equal(restartedRootCallCount, 1)
  assert.equal(restartedRootRun?.status, 'completed')
  assert.equal(restartedParentOutputs.length, 1)
  assert.equal(
    assistantReply?.content[0]?.text,
    'Startup child delivery reconciliation resumed the parent.',
  )
  assert.equal(
    restartedRuntime.db
      .select()
      .from(domainEvents)
      .all()
      .filter((event) => event.type === 'child_run.completed').length,
    1,
  )

  await closeAppRuntime(restartedRuntime)
})

test('child delivery interrupted after wait resolution resumes once on restart without duplicating child completion history', async () => {
  const harness = createTestHarness({
    AUTH_MODE: 'api_key',
    NODE_ENV: 'test',
  })
  const { app, config, runtime } = harness
  const { accountId, headers, tenantId } = seedApiKeyAuth(runtime)
  let simulatedCrash = false
  let initialRootCallCount = 0
  let restartRootCallCount = 0

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
      initialRootCallCount += 1
      return ok(
        buildDelegateResponse({
          task: 'Research the restart-safe child delivery crash',
        }),
      )
    }

    return ok(buildAssistantResponse('The child finished before the parent resumed.'))
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

  const originalTransaction = runtime.db.transaction.bind(runtime.db)
  ;(
    runtime.db as unknown as {
      transaction: typeof runtime.db.transaction
    }
  ).transaction = ((callback: Parameters<typeof runtime.db.transaction>[0]) => {
    const result = originalTransaction(callback)
    const waitRow = runtime.db.select().from(runDependencies).get()
    const parentOutputs = runtime.db
      .select()
      .from(items)
      .all()
      .filter((item) => item.runId === rootRunId && item.type === 'function_call_output')
    const rootRun = runtime.db.select().from(runs).where(eq(runs.id, rootRunId)).get()

    if (
      !simulatedCrash &&
      waitRow?.status === 'resolved' &&
      parentOutputs.length === 1 &&
      rootRun?.status === 'waiting'
    ) {
      simulatedCrash = true
      throw new Error('Simulated crash after child wait resolution')
    }

    return result
  }) as typeof runtime.db.transaction

  try {
    const reconciled = await runtime.services.multiagent.reconcileDecisions({
      kinds: ['deliver_resolved_child_result'],
      mode: 'startup',
    })
    assert.equal(reconciled.ok, false)
    if (reconciled.ok) {
      throw new Error('expected reconciliation to report the simulated crash')
    }
    assert.equal(reconciled.error.type, 'conflict')
    assert.match(reconciled.error.message, /Simulated crash after child wait resolution/)
  } finally {
    ;(
      runtime.db as unknown as {
        transaction: typeof runtime.db.transaction
      }
    ).transaction = originalTransaction
  }

  const midWait = runtime.db.select().from(runDependencies).get()
  const midRun = runtime.db.select().from(runs).where(eq(runs.id, rootRunId)).get()
  const midParentOutputs = runtime.db
    .select()
    .from(items)
    .all()
    .filter((item) => item.runId === rootRunId && item.type === 'function_call_output')
  const midEventTypes = runtime.db
    .select()
    .from(domainEvents)
    .all()
    .map((event) => event.type)

  assert.equal(simulatedCrash, true)
  assert.equal(initialRootCallCount, 1)
  assert.equal(midWait?.status, 'resolved')
  assert.equal(midRun?.status, 'waiting')
  assert.equal(midParentOutputs.length, 1)
  assert.equal(midEventTypes.filter((type) => type === 'child_run.completed').length, 1)
  assert.equal(midEventTypes.filter((type) => type === 'run.resumed').length, 0)

  await closeAppRuntime(runtime)

  const restartedRuntime = createAppRuntime(config)
  restartedRuntime.services.ai.interactions.generate = async (request: AiInteractionRequest) => {
    if (request.metadata?.runId === rootRunId) {
      restartRootCallCount += 1
      return ok(
        buildAssistantResponse(
          'Restart resumed the parent exactly once after child delivery crash.',
        ),
      )
    }

    return ok(
      buildAssistantResponse('Unexpected child execution after child-delivery recovery restart.'),
    )
  }
  wireStreamingStub(restartedRuntime)

  await initializeAppRuntime(restartedRuntime)
  await drainWorker(restartedRuntime)

  const finalWait = restartedRuntime.db.select().from(runDependencies).get()
  const finalRun = restartedRuntime.db.select().from(runs).where(eq(runs.id, rootRunId)).get()
  const finalParentOutputs = restartedRuntime.db
    .select()
    .from(items)
    .all()
    .filter((item) => item.runId === rootRunId && item.type === 'function_call_output')
  const assistantReply = restartedRuntime.db
    .select()
    .from(sessionMessages)
    .where(eq(sessionMessages.runId, rootRunId))
    .all()
    .find((message) => message.authorKind === 'assistant')
  const finalEventTypes = restartedRuntime.db
    .select()
    .from(domainEvents)
    .all()
    .map((event) => event.type)

  assert.equal(restartRootCallCount, 1)
  assert.equal(finalWait?.status, 'resolved')
  assert.equal(finalRun?.status, 'completed')
  assert.equal(finalParentOutputs.length, 1)
  assert.equal(
    assistantReply?.content[0]?.text,
    'Restart resumed the parent exactly once after child delivery crash.',
  )
  assert.equal(finalEventTypes.filter((type) => type === 'child_run.completed').length, 1)
  assert.equal(finalEventTypes.filter((type) => type === 'run.resumed').length, 1)

  await closeAppRuntime(restartedRuntime)
})
