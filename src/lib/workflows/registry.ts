import type { WorkflowDefinition } from './types'
import { documentChaseWorkflow } from './definitions/document-chase'
import { dataCollectionWorkflow } from './definitions/data-collection'
import { jobOfferWorkflow } from './definitions/job-offer'
import { profileCompletionWorkflow } from './definitions/profile-completion'
import { smartOnboardingWorkflow } from './definitions/smart-onboarding'

export const WORKFLOW_REGISTRY = new Map<string, WorkflowDefinition>([
  ['document_chase', documentChaseWorkflow],
  ['data_collection', dataCollectionWorkflow],
  ['job_offer', jobOfferWorkflow],
  ['profile_completion', profileCompletionWorkflow],
  ['smart_onboarding', smartOnboardingWorkflow],
])
