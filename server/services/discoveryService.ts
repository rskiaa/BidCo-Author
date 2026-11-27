import type { DiscoveryTenderItem } from '../../src/types/procurement.ts';

export interface PortalIntegrationStatus {
  portal: string;
  name: string;
  configured: boolean;
  mode: 'Authorized API' | 'Sample Reference Feed (DEMO DATA)';
  notes: string;
}

export function getPortalIntegrationStatuses(): PortalIntegrationStatus[] {
  const gemConfigured = Boolean(process.env.GEM_PORTAL_API_ENDPOINT && process.env.GEM_PORTAL_API_KEY);
  const cpppConfigured = Boolean(process.env.CPPP_FEED_ENDPOINT);
  const docAiConfigured = Boolean(
    process.env.DOCUMENT_AI_PROJECT_ID && process.env.DOCUMENT_AI_PROCESSOR_ID,
  );

  return [
    {
      portal: 'GeM',
      name: 'Government e-Marketplace (GeM)',
      configured: gemConfigured,
      mode: gemConfigured ? 'Authorized API' : 'Sample Reference Feed (DEMO DATA)',
      notes: gemConfigured
        ? 'Connected via GEM_PORTAL_API_ENDPOINT.'
        : 'Set GEM_PORTAL_API_ENDPOINT and GEM_PORTAL_API_KEY for live authorized GeM partner feeds.',
    },
    {
      portal: 'CPPP',
      name: 'Central Public Procurement Portal (eProcure)',
      configured: cpppConfigured,
      mode: cpppConfigured ? 'Authorized API' : 'Sample Reference Feed (DEMO DATA)',
      notes: cpppConfigured
        ? 'Connected via CPPP_FEED_ENDPOINT.'
        : 'Set CPPP_FEED_ENDPOINT to sync permitted CPPP/OCDS XML/JSON tender feeds.',
    },
    {
      portal: 'DocumentAI',
      name: 'Google Document AI OCR Processor',
      configured: docAiConfigured,
      mode: docAiConfigured ? 'Authorized API' : 'Sample Reference Feed (DEMO DATA)',
      notes: docAiConfigured
        ? 'Document AI processor configured; paired with Gemini multimodal PDF reader.'
        : 'Using built-in PDF parser + Gemini multimodal OCR. Optionally configure DOCUMENT_AI_PROCESSOR_ID.',
    },
  ];
}

// Clearly labeled DEMO DATA records for demonstration and testing without scraping restricted sites.
export const DEMO_DISCOVERY_TENDERS: DiscoveryTenderItem[] = [
  {
    externalId: 'demo_gem_2026_001',
    referenceNumber: 'GEM/2026/B/5148920',
    title: 'Enterprise Cloud SOC & Zero-Trust Network Modernization for State Secretariat',
    authority: 'State Directorate of Information Technology & e-Governance',
    department: 'Electronics & IT Department',
    location: 'Bengaluru, Karnataka',
    industry: 'IT & Cybersecurity',
    sourceType: 'DEMO_DATA',
    sourcePortal: 'GeM (DEMO DATA)',
    estimatedValueLakhs: 640,
    emdAmountLakhs: 12.8,
    tenderFeeInr: 11800,
    deadlineDate: '2026-12-22',
    publishDate: '2026-11-15',
    summary:
      'Design, deployment, and 36-month managed SOC operations for 24x7 cybersecurity monitoring, SIEM/SOAR integration, and CERT-In compliance across 42 state department portals.',
    eligibilityHighlight: 'Min Avg Turnover INR 400 Lakhs · ISO 27001 & CERT-In Empanelment',
    minTurnoverLakhs: 400,
    requiredCertifications: ['ISO 9001:2015', 'ISO/IEC 27001:2022', 'CERT-In Empanelled'],
  },
  {
    externalId: 'demo_cppp_2026_002',
    referenceNumber: 'CPPP/NHAI/2026/TMS-104',
    title: 'AI-Assisted Highway Traffic Management & ANPR Tolling Analytics Platform',
    authority: 'National Highway Digital Infrastructure Authority',
    department: 'Ministry of Road Transport & Highways',
    location: 'New Delhi / Pan-India',
    industry: 'Smart Mobility & AI',
    sourceType: 'DEMO_DATA',
    sourcePortal: 'CPPP (DEMO DATA)',
    estimatedValueLakhs: 920,
    emdAmountLakhs: 18.4,
    tenderFeeInr: 23600,
    deadlineDate: '2026-12-30',
    publishDate: '2026-11-18',
    summary:
      'Supply, edge-AI camera integration, and command-center analytics dashboard across 18 expressway toll plazas with 99.5% SLA uptime and 5-year O&M.',
    eligibilityHighlight: 'Min Avg Turnover INR 600 Lakhs · 2 ITS/ANPR Gov Projects >= INR 250 Lakhs',
    minTurnoverLakhs: 600,
    requiredCertifications: ['ISO 9001:2015', 'CMMI Level 3'],
  },
  {
    externalId: 'demo_gem_2026_003',
    referenceNumber: 'GEM/2026/B/5192044',
    title: 'Smart Urban Water Supply SCADA Telemetry & Leak Detection System',
    authority: 'Municipal Water & Sewerage Board',
    department: 'Urban Development & Housing',
    location: 'Pune, Maharashtra',
    industry: 'Water & Smart Infrastructure',
    sourceType: 'DEMO_DATA',
    sourcePortal: 'GeM (DEMO DATA)',
    estimatedValueLakhs: 480,
    emdAmountLakhs: 9.6,
    tenderFeeInr: 11800,
    deadlineDate: '2026-12-28',
    publishDate: '2026-11-20',
    summary:
      'Turnkey SCADA instrumentation, 120 ultrasonic IoT flow meters, RTU telemetry, and cloud predictive leak analytics hosted on MeitY-empanelled infrastructure.',
    eligibilityHighlight: 'Min Avg Turnover INR 350 Lakhs · ISO 9001 & ISO 27001',
    minTurnoverLakhs: 350,
    requiredCertifications: ['ISO 9001:2015', 'ISO/IEC 27001:2022'],
  },
  {
    externalId: 'demo_cppp_2026_004',
    referenceNumber: 'CPPP/MSME/2026/ERP-029',
    title: 'Digitization & Grievance Redressal SaaS Platform for MSME Cluster Facilitation',
    authority: 'Office of Development Commissioner (MSME)',
    department: 'Ministry of Micro, Small & Medium Enterprises',
    location: 'Hyderabad, Telangana',
    industry: 'IT & Software Services',
    sourceType: 'DEMO_DATA',
    sourcePortal: 'CPPP (DEMO DATA)',
    estimatedValueLakhs: 185,
    emdAmountLakhs: 0,
    tenderFeeInr: 5900,
    deadlineDate: '2026-12-16',
    publishDate: '2026-11-12',
    summary:
      'Cloud-native multilingual portal, workflow automation, and analytics workspace for 140 MSME cluster centers. EMD exempted for valid Udyam MSMEs & DPIIT startups.',
    eligibilityHighlight: 'Min Avg Turnover INR 120 Lakhs (Relaxed for MSME/Startups) · ISO 9001',
    minTurnoverLakhs: 120,
    requiredCertifications: ['ISO 9001:2015'],
  },
  {
    externalId: 'demo_gem_2026_005',
    referenceNumber: 'GEM/2026/B/5210381',
    title: 'Solar Microgrid & Battery Energy Storage EPC for 35 Rural Primary Health Centers',
    authority: 'State Renewable Energy Development Agency',
    department: 'New & Renewable Energy Department',
    location: 'Jaipur, Rajasthan',
    industry: 'Renewable Energy & EPC',
    sourceType: 'DEMO_DATA',
    sourcePortal: 'GeM (DEMO DATA)',
    estimatedValueLakhs: 540,
    emdAmountLakhs: 10.8,
    tenderFeeInr: 14750,
    deadlineDate: '2027-01-08',
    publishDate: '2026-11-22',
    summary:
      'Design, supply, installation, and 5-year comprehensive AMC of 25kWp solar hybrid microgrids with LiFePO4 storage and remote IoT inverter telemetry.',
    eligibilityHighlight: 'Min Avg Turnover INR 300 Lakhs · MNRE Channel Partner / ISO 14001',
    minTurnoverLakhs: 300,
    requiredCertifications: ['ISO 9001:2015', 'ISO 14001:2015'],
  },
  {
    externalId: 'demo_cppp_2026_006',
    referenceNumber: 'CPPP/HEALTH/2026/HIMS-88',
    title: 'District Hospital Tele-Radiology & ABDM-Compliant Diagnostic Cloud Archive',
    authority: 'State Health Systems Resource Directorate',
    department: 'Department of Health & Family Welfare',
    location: 'Chennai, Tamil Nadu',
    industry: 'Healthcare IT',
    sourceType: 'DEMO_DATA',
    sourcePortal: 'CPPP (DEMO DATA)',
    estimatedValueLakhs: 390,
    emdAmountLakhs: 7.8,
    tenderFeeInr: 10000,
    deadlineDate: '2026-12-19',
    publishDate: '2026-11-10',
    summary:
      'PACS/DICOM cloud archive, AI triage integration, and ABDM-compliant EHR interoperability across 28 district hospitals with 99.9% uptime SLA.',
    eligibilityHighlight: 'Min Avg Turnover INR 250 Lakhs · ISO 27001 & HL7/ABDM Readiness',
    minTurnoverLakhs: 250,
    requiredCertifications: ['ISO 9001:2015', 'ISO/IEC 27001:2022', 'ISO 13485'],
  },
];

export function filterDiscoveryTenders(params: {
  q?: string;
  industry?: string;
  location?: string;
  department?: string;
  maxBudgetLakhs?: number;
  minBudgetLakhs?: number;
  maxTurnoverLakhs?: number;
  deadlineBefore?: string;
}): DiscoveryTenderItem[] {
  const q = (params.q || '').trim().toLowerCase();
  const industry = (params.industry || '').trim().toLowerCase();
  const location = (params.location || '').trim().toLowerCase();
  const department = (params.department || '').trim().toLowerCase();

  return DEMO_DISCOVERY_TENDERS.filter((item) => {
    if (
      q &&
      !`${item.title} ${item.referenceNumber} ${item.authority} ${item.summary} ${item.industry}`
        .toLowerCase()
        .includes(q)
    ) {
      return false;
    }
    if (industry && industry !== 'all' && !item.industry.toLowerCase().includes(industry)) {
      return false;
    }
    if (location && !item.location.toLowerCase().includes(location)) {
      return false;
    }
    if (department && !item.department.toLowerCase().includes(department)) {
      return false;
    }
    if (
      typeof params.minBudgetLakhs === 'number' &&
      !Number.isNaN(params.minBudgetLakhs) &&
      item.estimatedValueLakhs < params.minBudgetLakhs
    ) {
      return false;
    }
    if (
      typeof params.maxBudgetLakhs === 'number' &&
      !Number.isNaN(params.maxBudgetLakhs) &&
      item.estimatedValueLakhs > params.maxBudgetLakhs
    ) {
      return false;
    }
    if (
      typeof params.maxTurnoverLakhs === 'number' &&
      !Number.isNaN(params.maxTurnoverLakhs) &&
      item.minTurnoverLakhs > params.maxTurnoverLakhs
    ) {
      return false;
    }
    if (params.deadlineBefore && item.deadlineDate > params.deadlineBefore) {
      return false;
    }
    return true;
  });
}
