export type TenderStatus =
  | 'Discovered'
  | 'Under Review'
  | 'Eligibility Checking'
  | 'Bid Preparation'
  | 'Internal Review'
  | 'Submitted'
  | 'Won'
  | 'Lost';

export type EligibilityStatus =
  | 'Not Checked'
  | 'Eligible'
  | 'Potentially Eligible'
  | 'Ineligible'
  | 'Insufficient Information';

export type TenderSourceType = 'DEMO_DATA' | 'UPLOADED_PDF' | 'PORTAL_SYNC';

export type UserRole = 'admin' | 'bid_manager' | 'reviewer' | 'viewer';

export type RiskSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  orgId?: string;
  role: UserRole;
  jobTitle?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Organization {
  id: string;
  ownerId: string;
  memberUids: string[];
  name: string;
  registrationNumber?: string;
  gstin?: string;
  panNumber?: string;
  udyamNumber?: string;
  industry: string;
  businessCategory?: string;
  headquarters?: string;
  yearsInOperation?: number;
  annualTurnoverLakhs?: number;
  netWorthLakhs?: number;
  employeeCount?: number;
  capabilitiesSummary?: string;
  certifications?: string[];
  pastProjectsSummary?: string;
  website?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TeamMember {
  id: string;
  orgId: string;
  ownerId: string;
  memberUids: string[];
  uid?: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: 'active' | 'invited';
  department?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  required: boolean;
}

export interface TenderRecord {
  id: string;
  orgId: string;
  ownerId: string;
  memberUids: string[];
  referenceNumber: string;
  title: string;
  authority: string;
  department?: string;
  location?: string;
  industry?: string;
  sourceType: TenderSourceType;
  sourcePortal?: string;
  estimatedValueLakhs?: number;
  emdAmountLakhs?: number;
  tenderFeeInr?: number;
  deadlineDate?: string;
  publishDate?: string;
  status: TenderStatus;
  eligibilityStatus?: EligibilityStatus;
  assignedToUid?: string;
  assignedToName?: string;
  reminderEnabled?: boolean;
  summary?: string;
  isSaved?: boolean;
  documentId?: string;
  checklist?: ChecklistItem[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DocumentChunk {
  id: string;
  orgId: string;
  ownerId: string;
  memberUids: string[];
  documentId: string;
  chunkIndex: number;
  pageNumber: number;
  sectionType?: string;
  content: string;
  embedding?: number[];
  createdAt?: unknown;
}

export interface TenderDocument {
  id: string;
  orgId: string;
  ownerId: string;
  memberUids: string[];
  tenderId?: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes?: number;
  pageCount: number;
  chunkCount: number;
  extractedPreview?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CitedFinding {
  item: string;
  category?: string;
  mandatory?: boolean;
  sourcePage: string;
  evidenceQuote: string;
}

export interface TenderDateItem {
  event: string;
  dateValue: string;
  sourcePage: string;
  evidenceQuote: string;
}

export interface TenderAnalysis {
  id: string;
  orgId: string;
  ownerId: string;
  memberUids: string[];
  tenderId: string;
  documentId?: string;
  executiveSummary: string;
  tenderMetadata?: {
    referenceNumber?: string;
    issuingAuthority?: string;
    estimatedValue?: string;
    emdRequirement?: string;
    tenderFee?: string;
    performanceSecurity?: string;
    submissionDeadline?: string;
    bidValidityDays?: string;
  };
  eligibilityCriteria?: CitedFinding[];
  technicalSpecs?: CitedFinding[];
  financialRequirements?: CitedFinding[];
  importantDates?: TenderDateItem[];
  mandatoryDocuments?: CitedFinding[];
  disqualificationConditions?: CitedFinding[];
  initialRisks?: Array<{
    clause: string;
    severity: RiskSeverity;
    sourcePage: string;
    evidenceQuote: string;
  }>;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface EligibilityComparisonRow {
  requirement: string;
  category: string;
  companyEvidence: string;
  status: 'Met' | 'Partial' | 'Not Met' | 'Missing Info';
  sourcePage: string;
  evidenceQuote: string;
  remediationNote: string;
}

export interface EligibilityAssessment {
  id: string;
  orgId: string;
  ownerId: string;
  memberUids: string[];
  tenderId: string;
  overallStatus: 'Eligible' | 'Potentially Eligible' | 'Ineligible' | 'Insufficient Information';
  summary: string;
  financialAssessment?: string;
  experienceAssessment?: string;
  certificationAssessment?: string;
  comparisons?: EligibilityComparisonRow[];
  missingDocuments?: string[];
  complianceGaps?: string[];
  disqualificationRisks?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ProposalSection {
  id: string;
  heading: string;
  content: string;
  missingInputs: string[];
}

export interface ProposalVersion {
  versionNumber: number;
  savedAt: string;
  savedBy: string;
  note: string;
  sections: ProposalSection[];
}

export interface GeneratedProposal {
  id: string;
  orgId: string;
  ownerId: string;
  memberUids: string[];
  tenderId: string;
  title: string;
  templateType: string;
  currentVersion: number;
  sections: ProposalSection[];
  complianceNotes?: string[];
  versions?: ProposalVersion[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CostInputs {
  directLaborLakhs: number;
  materialsAndOemLakhs: number;
  subcontractorsLakhs: number;
  logisticsAndDeploymentLakhs: number;
  overheadPercent: number;
  contingencyPercent: number;
  workingCapitalCostPercent: number;
}

export interface BidScenario {
  name: string;
  strategy: string;
  targetMarginPercent: number;
  baseCostLakhs: number;
  bidPriceLakhs: number;
  grossProfitLakhs: number;
  netMarginPercent: number;
  varianceVsBudgetPercent: number;
  pbgLockupLakhs: number;
  notes: string;
}

export interface FinancialAnalysis {
  id: string;
  orgId: string;
  ownerId: string;
  memberUids: string[];
  tenderId: string;
  tenderBudgetLakhs: number;
  emdLakhs?: number;
  pbgPercent?: number;
  costInputs: CostInputs;
  scenarios: BidScenario[];
  aiCommentary?: string;
  recommendedBidLakhs?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RiskItem {
  id: string;
  title: string;
  category: string;
  severity: RiskSeverity;
  description: string;
  mitigation: string;
  sourcePage: string;
  evidenceQuote: string;
}

export interface RiskReport {
  id: string;
  orgId: string;
  ownerId: string;
  memberUids: string[];
  tenderId: string;
  overallRiskLevel: RiskSeverity;
  executiveSummary: string;
  risks: RiskItem[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ActivityLog {
  id: string;
  orgId: string;
  ownerId: string;
  memberUids: string[];
  tenderId?: string;
  actorUid: string;
  actorName: string;
  actionType: string;
  description: string;
  createdAt?: unknown;
}

export interface NotificationItem {
  id: string;
  orgId: string;
  ownerId: string;
  memberUids: string[];
  tenderId?: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  isRead: boolean;
  createdAt?: unknown;
}

export interface DiscoveryTenderItem {
  externalId: string;
  referenceNumber: string;
  title: string;
  authority: string;
  department: string;
  location: string;
  industry: string;
  sourceType: TenderSourceType;
  sourcePortal: string;
  estimatedValueLakhs: number;
  emdAmountLakhs: number;
  tenderFeeInr: number;
  deadlineDate: string;
  publishDate: string;
  summary: string;
  eligibilityHighlight: string;
  minTurnoverLakhs: number;
  requiredCertifications: string[];
}
