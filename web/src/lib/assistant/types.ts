export type AssistantMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export const ASSISTANT_EDITION_SIZES = ['Small', 'Large', 'Extra Large'] as const
export const ASSISTANT_EDITION_FRAME_TYPES = ['Framed', 'Tube only', 'Mounted'] as const

export type AssistantEditionSize = (typeof ASSISTANT_EDITION_SIZES)[number]
export type AssistantEditionFrameType = (typeof ASSISTANT_EDITION_FRAME_TYPES)[number]

export type InventoryAction =
  | {
      type: 'mark_printed'
      edition_ids: number[]
      size?: AssistantEditionSize
      frame_type?: AssistantEditionFrameType
    }
  | {
      type: 'update_physical_details'
      edition_ids: number[]
      size?: AssistantEditionSize
      frame_type?: AssistantEditionFrameType
    }
  | {
      type: 'mark_sold'
      edition_ids: number[]
      retail_price: number
      date_sold: string
    }
  | {
      type: 'move_stock'
      edition_ids: number[]
      distributor_id: number
      date_in_gallery: string
    }
  | {
      type: 'confirm_stock_present'
      edition_ids: number[]
      distributor_id: number
    }
  | {
      type: 'report_stock_missing'
      edition_ids: number[]
      distributor_id: number
    }
  | {
      type: 'receive_stock_at_gallery'
      edition_ids: number[]
      distributor_id: number
      date_in_gallery: string
    }

export type ProposalFieldChange = {
  field:
    | 'is_printed'
    | 'is_sold'
    | 'is_settled'
    | 'retail_price'
    | 'date_sold'
    | 'commission_percentage'
    | 'location'
    | 'date_in_gallery'
    | 'is_stock_checked'
    | 'size'
    | 'frame_type'
  label: string
  before: string
  after: string
}

export type ProposalEditionPreview = {
  editionId: number
  editionName: string
  artworkName: string
  editionLabel: string
  changes: ProposalFieldChange[]
}

export type ProposalPreview = {
  summary: string
  editions: ProposalEditionPreview[]
  warnings: string[]
}

export type AssistantProposalStatus =
  | 'pending'
  | 'applied'
  | 'rejected'
  | 'superseded'
  | 'expired'
  | 'stale'

export type AssistantProposal = {
  id: string
  status: AssistantProposalStatus
  preview: ProposalPreview
  expiresAt: string
  appliedAt: string | null
  result?: Record<string, unknown> | null
  undoable?: boolean
  revertsProposalId?: string | null
}

export type AssistantConversationResponse = {
  conversationId: string
  messages: AssistantMessage[]
  proposal: AssistantProposal | null
}

export type AssistantConversationSummary = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export type ApplyProposalResult = {
  ok: boolean
  status: AssistantProposalStatus
  message?: string
  proposal_id?: string
  edition_count?: number
}
