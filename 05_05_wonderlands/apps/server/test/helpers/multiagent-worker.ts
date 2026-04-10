import assert from 'node:assert/strict'
import { eq } from 'drizzle-orm'
import { test } from 'vitest'
import { closeAppRuntime, createAppRuntime, initializeAppRuntime } from '../../src/app/runtime'
import { createExecuteRunCommand } from '../../src/application/commands/execute-run'
import { createInternalCommandContext } from '../../src/application/commands/internal-command-context'
import { createResumeRunCommand } from '../../src/application/commands/resume-run'
import { createStartThreadInteractionCommand } from '../../src/application/commands/start-thread-interaction'
import {
  agentRevisions,
  agentSubagentLinks,
  agents,
  domainEvents,
  items,
  jobs,
  runClaims,
  runDependencies,
  runs,
  sessionMessages,
  toolExecutions,
} from '../../src/db/schema'
import type { AiInteractionRequest, AiInteractionResponse } from '../../src/domain/ai/types'
import { createItemRepository } from '../../src/domain/runtime/item-repository'
import { createRunClaimRepository } from '../../src/domain/runtime/run-claim-repository'
import { createRunDependencyRepository } from '../../src/domain/runtime/run-dependency-repository'
import { createToolExecutionRepository } from '../../src/domain/runtime/tool-execution-repository'
import { asAccountId, asItemId, asRunId, asTenantId } from '../../src/shared/ids'
import { err, ok } from '../../src/shared/result'
import { seedApiKeyAuth } from './api-key-auth'
import { createTestHarness } from './create-test-app'
import { grantNativeToolToDefaultAgent } from './grant-native-tool-agent'

export { assert, eq, test }
export {
  closeAppRuntime,
  createAppRuntime,
  initializeAppRuntime,
  createExecuteRunCommand,
  createInternalCommandContext,
  createResumeRunCommand,
  createStartThreadInteractionCommand,
  agentRevisions,
  agentSubagentLinks,
  agents,
  domainEvents,
  items,
  jobs,
  runClaims,
  runDependencies,
  runs,
  sessionMessages,
  toolExecutions,
  createItemRepository,
  createRunClaimRepository,
  createRunDependencyRepository,
  createToolExecutionRepository,
  asAccountId,
  asItemId,
  asRunId,
  asTenantId,
  err,
  ok,
  seedApiKeyAuth,
  createTestHarness,
}
export type { AiInteractionRequest, AiInteractionResponse }

const wireStreamingStub = (runtime: ReturnType<typeof createTestHarness>['runtime']) => {
  runtime.services.ai.interactions.stream = async (request) => {
    const generated = await runtime.services.ai.interactions.generate(request)

    if (!generated.ok) {
      return generated
    }

    return ok(
      (async function* () {
        yield {
          model: generated.value.model,
          provider: generated.value.provider,
          responseId: generated.value.responseId,
          type: 'response.started' as const,
        }

        if (generated.value.outputText.length > 0) {
          yield {
            delta: generated.value.outputText,
            type: 'text.delta' as const,
          }
        }

        for (const toolCall of generated.value.toolCalls) {
          yield {
            call: toolCall,
            type: 'tool.call' as const,
          }
        }

        yield {
          response: generated.value,
          type: 'response.completed' as const,
        }
      })(),
    )
  }
}

const seedActiveAgent = (
  runtime: ReturnType<typeof createTestHarness>['runtime'],
  input: {
    accountId: string
    agentId: string
    modelAlias: string
    name: string
    nativeTools?: string[]
    profile: string
    provider: 'openai' | 'google'
    revisionId: string
    slug: string
    tenantId?: string
  },
) => {
  const tenantId = input.tenantId ?? 'ten_test'
  const createdAt = '2026-03-30T05:00:00.000Z'

  runtime.db
    .insert(agents)
    .values({
      activeRevisionId: input.revisionId,
      archivedAt: null,
      baseAgentId: null,
      createdAt,
      createdByAccountId: input.accountId,
      id: input.agentId,
      kind: 'primary',
      name: input.name,
      ownerAccountId: input.accountId,
      slug: input.slug,
      status: 'active',
      tenantId,
      updatedAt: createdAt,
      visibility: 'account_private',
    })
    .run()

  runtime.db
    .insert(agentRevisions)
    .values({
      agentId: input.agentId,
      checksumSha256: `${input.revisionId}_checksum`,
      createdAt,
      createdByAccountId: input.accountId,
      frontmatterJson: {
        agent_id: input.agentId,
        kind: 'primary',
        name: input.name,
        revision_id: input.revisionId,
        schema: 'agent/v1',
        slug: input.slug,
        visibility: 'account_private',
      },
      gardenFocusJson: {},
      id: input.revisionId,
      instructionsMd: `${input.name} instructions`,
      kernelPolicyJson: {},
      memoryPolicyJson: {},
      modelConfigJson: {
        modelAlias: input.modelAlias,
        provider: input.provider,
      },
      resolvedConfigJson: {},
      sourceMarkdown: `---\nname: ${input.name}\nschema: agent/v1\nslug: ${input.slug}\nvisibility: account_private\nkind: primary\n---\n${input.name} instructions`,
      tenantId,
      toolProfileId: `tpf_${input.profile}`,
      toolPolicyJson: {
        toolProfileId: `tpf_${input.profile}`,
        ...(input.nativeTools ? { native: input.nativeTools } : {}),
      },
      version: 1,
      sandboxPolicyJson: {},
      workspacePolicyJson: {},
    })
    .run()
}

const seedSubagentLink = (
  runtime: ReturnType<typeof createTestHarness>['runtime'],
  input: {
    alias: string
    childAgentId: string
    id: string
    parentAgentRevisionId: string
    tenantId?: string
  },
) => {
  runtime.db
    .insert(agentSubagentLinks)
    .values({
      alias: input.alias,
      childAgentId: input.childAgentId,
      createdAt: '2026-03-30T05:00:00.000Z',
      delegationMode: 'async_join',
      id: input.id,
      parentAgentRevisionId: input.parentAgentRevisionId,
      position: 0,
      tenantId: input.tenantId ?? 'ten_test',
    })
    .run()
}

const bootstrapSession = async (
  app: ReturnType<typeof createTestHarness>['app'],
  headers: Record<string, string>,
  agentId: string,
) => {
  const response = await app.request('http://local/v1/sessions/bootstrap', {
    body: JSON.stringify({
      initialMessage: 'Coordinate the multiagent work',
      target: {
        agentId,
        kind: 'agent',
      },
      title: 'Worker lifecycle test',
    }),
    headers: {
      ...headers,
      'content-type': 'application/json',
    },
    method: 'POST',
  })

  assert.equal(response.status, 201)
  return response.json()
}

const bootstrapPlannerRun = async (
  app: ReturnType<typeof createTestHarness>['app'],
  headers: Record<string, string>,
) => {
  const response = await app.request('http://local/v1/sessions/bootstrap', {
    body: JSON.stringify({
      initialMessage: 'Recover the waiting run',
      title: 'Wait timeout recovery test',
    }),
    headers: {
      ...headers,
      'content-type': 'application/json',
    },
    method: 'POST',
  })

  assert.equal(response.status, 201)
  return response.json()
}

const executeRun = async (
  app: ReturnType<typeof createTestHarness>['app'],
  headers: Record<string, string>,
  runId: string,
) => {
  const response = await app.request(`http://local/v1/runs/${runId}/execute`, {
    body: JSON.stringify({}),
    headers: {
      ...headers,
      'content-type': 'application/json',
    },
    method: 'POST',
  })

  return {
    body: await response.json(),
    response,
  }
}

const cancelRun = async (
  app: ReturnType<typeof createTestHarness>['app'],
  headers: Record<string, string>,
  runId: string,
) => {
  const response = await app.request(`http://local/v1/runs/${runId}/cancel`, {
    body: JSON.stringify({}),
    headers: {
      ...headers,
      'content-type': 'application/json',
    },
    method: 'POST',
  })

  return {
    body: await response.json(),
    response,
  }
}

const registerFunctionTool = (
  runtime: ReturnType<typeof createTestHarness>['runtime'],
  input: {
    execute: (args: unknown) => Promise<ReturnType<typeof ok> | ReturnType<typeof err>>
    name: string
  },
) => {
  grantNativeToolToDefaultAgent(runtime, input.name)

  runtime.services.tools.register({
    description: `Test tool ${input.name}`,
    domain: 'native',
    execute: async (_context, args) => input.execute(args),
    inputSchema: {
      additionalProperties: false,
      properties: {},
      required: [],
      type: 'object',
    },
    name: input.name,
  })
}

const buildDelegateResponse = (input: {
  agentAlias?: string
  callId?: string
  instructions?: string
  task: string
}): AiInteractionResponse => ({
  messages: [],
  model: 'gpt-5.4',
  output: [
    {
      arguments: {
        agentAlias: input.agentAlias ?? 'researcher',
        ...(input.instructions ? { instructions: input.instructions } : {}),
        task: input.task,
      },
      argumentsJson: JSON.stringify({
        agentAlias: input.agentAlias ?? 'researcher',
        ...(input.instructions ? { instructions: input.instructions } : {}),
        task: input.task,
      }),
      callId: input.callId ?? 'call_delegate_1',
      name: 'delegate_to_agent',
      type: 'function_call',
    },
  ],
  outputText: '',
  provider: 'openai',
  providerRequestId: 'req_delegate_1',
  raw: { stub: true },
  responseId: 'resp_delegate_1',
  status: 'completed',
  toolCalls: [
    {
      arguments: {
        agentAlias: input.agentAlias ?? 'researcher',
        ...(input.instructions ? { instructions: input.instructions } : {}),
        task: input.task,
      },
      argumentsJson: JSON.stringify({
        agentAlias: input.agentAlias ?? 'researcher',
        ...(input.instructions ? { instructions: input.instructions } : {}),
        task: input.task,
      }),
      callId: input.callId ?? 'call_delegate_1',
      name: 'delegate_to_agent',
    },
  ],
  usage: null,
})

const buildReasoningDelegateResponse = (input: {
  agentAlias: string
  callId: string
  instructions?: string
  reasoning: string
  reasoningId: string
  task: string
}): AiInteractionResponse => ({
  messages: [],
  model: 'gpt-5.4',
  output: [
    {
      id: input.reasoningId,
      summary: [
        {
          text: input.reasoning,
          type: 'summary_text',
        },
      ],
      text: input.reasoning,
      type: 'reasoning',
    },
    {
      arguments: {
        agentAlias: input.agentAlias,
        ...(input.instructions ? { instructions: input.instructions } : {}),
        task: input.task,
      },
      argumentsJson: JSON.stringify({
        agentAlias: input.agentAlias,
        ...(input.instructions ? { instructions: input.instructions } : {}),
        task: input.task,
      }),
      callId: input.callId,
      name: 'delegate_to_agent',
      type: 'function_call',
    },
  ],
  outputText: '',
  provider: 'openai',
  providerRequestId: 'req_delegate_reasoning',
  raw: { stub: true },
  responseId: 'resp_delegate_reasoning',
  status: 'completed',
  toolCalls: [
    {
      arguments: {
        agentAlias: input.agentAlias,
        ...(input.instructions ? { instructions: input.instructions } : {}),
        task: input.task,
      },
      argumentsJson: JSON.stringify({
        agentAlias: input.agentAlias,
        ...(input.instructions ? { instructions: input.instructions } : {}),
        task: input.task,
      }),
      callId: input.callId,
      name: 'delegate_to_agent',
    },
  ],
  usage: null,
})

const buildAssistantResponse = (text: string, outputText = text): AiInteractionResponse => ({
  messages: [
    {
      content: [{ text, type: 'text' }],
      role: 'assistant',
    },
  ],
  model: 'gpt-5.4',
  output: [
    {
      content: [{ text, type: 'text' }],
      role: 'assistant',
      type: 'message',
    },
  ],
  outputText,
  provider: 'openai',
  providerRequestId: 'req_text',
  raw: { stub: true },
  responseId: 'resp_text',
  status: 'completed',
  toolCalls: [],
  usage: null,
})

const buildReasoningAssistantResponse = (input: {
  reasoning: string
  reasoningId: string
  text: string
  webSearches?: AiInteractionResponse['webSearches']
}): AiInteractionResponse => ({
  messages: [
    {
      content: [{ text: input.text, type: 'text' }],
      role: 'assistant',
    },
  ],
  model: 'gpt-5.4',
  output: [
    {
      id: input.reasoningId,
      summary: [
        {
          text: input.reasoning,
          type: 'summary_text',
        },
      ],
      text: input.reasoning,
      type: 'reasoning',
    },
    {
      content: [{ text: input.text, type: 'text' }],
      role: 'assistant',
      type: 'message',
    },
  ],
  outputText: input.text,
  provider: 'openai',
  providerRequestId: 'req_reasoning_text',
  raw: { stub: true },
  responseId: 'resp_reasoning_text',
  status: 'completed',
  toolCalls: [],
  usage: null,
  webSearches: input.webSearches ?? [],
})

const drainWorker = async (
  runtime: ReturnType<typeof createTestHarness>['runtime'],
  maxIterations = 20,
) => {
  for (let index = 0; index < maxIterations; index += 1) {
    const worked = await runtime.services.multiagent.processAvailableDecisions()

    if (!worked) {
      break
    }
  }
}

export {
  wireStreamingStub,
  seedActiveAgent,
  seedSubagentLink,
  bootstrapSession,
  bootstrapPlannerRun,
  executeRun,
  cancelRun,
  registerFunctionTool,
  buildDelegateResponse,
  buildReasoningDelegateResponse,
  buildAssistantResponse,
  buildReasoningAssistantResponse,
  drainWorker,
}
