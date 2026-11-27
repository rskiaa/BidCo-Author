import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase.ts';
import type {
  ActivityLog,
  DocumentChunk,
  EligibilityAssessment,
  FinancialAnalysis,
  GeneratedProposal,
  NotificationItem,
  Organization,
  RiskReport,
  TeamMember,
  TenderAnalysis,
  TenderDocument,
  TenderRecord,
  UserProfile,
} from '../types/procurement.ts';

export function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`.replace(/[^a-zA-Z0-9_\-]/g, '_');
}

// --- User & Organization Bootstrap ---
export async function syncUserProfile(params: {
  uid: string;
  email: string;
  displayName: string;
}): Promise<UserProfile> {
  const path = `users/${params.uid}`;
  const ref = doc(db, 'users', params.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    const profile: UserProfile = {
      uid: params.uid,
      email: params.email.slice(0, 254),
      displayName: (params.displayName || params.email.split('@')[0] || 'Procurement Lead').slice(0, 120),
      role: 'bid_manager',
      jobTitle: 'Bid Manager',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, profile);
    return profile;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function createOrganizationAndProfile(params: {
  uid: string;
  email: string;
  displayName: string;
  orgInput: Omit<Organization, 'id' | 'ownerId' | 'memberUids' | 'createdAt' | 'updatedAt'>;
}): Promise<Organization> {
  const orgId = makeSafeId('org');
  const orgPath = `organizations/${orgId}`;
  const orgData: Organization = {
    id: orgId,
    ownerId: params.uid,
    memberUids: [params.uid],
    ...params.orgInput,
    name: params.orgInput.name.slice(0, 200),
    industry: params.orgInput.industry.slice(0, 120),
    certifications: (params.orgInput.certifications || []).slice(0, 25),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'organizations', orgId), orgData);

    // Link user profile to org
    await updateDoc(doc(db, 'users', params.uid), {
      orgId,
      updatedAt: serverTimestamp(),
    });

    // Create initial owner membership record
    const memberId = params.uid;
    const member: TeamMember = {
      id: memberId,
      orgId,
      ownerId: params.uid,
      memberUids: [params.uid],
      uid: params.uid,
      email: params.email.slice(0, 254),
      displayName: (params.displayName || 'Organization Owner').slice(0, 120),
      role: 'admin',
      status: 'active',
      department: 'Executive & Procurement',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'organizations', orgId, 'members', memberId), member);

    return orgData;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, orgPath);
  }
}

export async function updateOrganizationProfile(
  orgId: string,
  updates: Partial<Organization>,
): Promise<void> {
  const path = `organizations/${orgId}`;
  try {
    const clean = { ...updates } as Record<string, unknown>;
    delete clean.id;
    delete clean.ownerId;
    delete clean.createdAt;
    clean.updatedAt = serverTimestamp();
    await updateDoc(doc(db, 'organizations', orgId), clean);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateUserProfileFields(
  uid: string,
  updates: { displayName?: string; jobTitle?: string },
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// --- Real-Time Organization Subscriptions ---
export function subscribeOrgSubcollection<T>(
  orgId: string,
  subcollection: string,
  uid: string,
  onData: (items: T[]) => void,
): Unsubscribe {
  const path = `organizations/${orgId}/${subcollection}`;
  const q = query(
    collection(db, 'organizations', orgId, subcollection),
    where('memberUids', 'array-contains', uid),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data() as T);
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

export function subscribeOrganization(
  orgId: string,
  onData: (org: Organization | null) => void,
): Unsubscribe {
  const path = `organizations/${orgId}`;
  return onSnapshot(
    doc(db, 'organizations', orgId),
    (snap) => {
      onData(snap.exists() ? (snap.data() as Organization) : null);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    },
  );
}

// --- Tender CRUD & Logs ---
export async function saveTenderRecord(
  org: Organization,
  tender: Omit<TenderRecord, 'orgId' | 'ownerId' | 'memberUids' | 'createdAt' | 'updatedAt'>,
): Promise<void> {
  const path = `organizations/${org.id}/tenders/${tender.id}`;
  try {
    const payload: TenderRecord = {
      ...tender,
      orgId: org.id,
      ownerId: org.ownerId,
      memberUids: org.memberUids,
      title: tender.title.slice(0, 350),
      authority: tender.authority.slice(0, 250),
      referenceNumber: tender.referenceNumber.slice(0, 140),
      summary: (tender.summary || '').slice(0, 4000),
      checklist: (tender.checklist || []).slice(0, 30),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'organizations', org.id, 'tenders', tender.id), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateTenderRecord(
  orgId: string,
  tenderId: string,
  updates: Partial<TenderRecord>,
): Promise<void> {
  const path = `organizations/${orgId}/tenders/${tenderId}`;
  try {
    const clean = { ...updates } as Record<string, unknown>;
    delete clean.id;
    delete clean.orgId;
    delete clean.ownerId;
    delete clean.createdAt;
    clean.updatedAt = serverTimestamp();
    await updateDoc(doc(db, 'organizations', orgId, 'tenders', tenderId), clean);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteTenderRecord(orgId: string, tenderId: string): Promise<void> {
  const path = `organizations/${orgId}/tenders/${tenderId}`;
  try {
    await deleteDoc(doc(db, 'organizations', orgId, 'tenders', tenderId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// --- Document & RAG Chunks ---
export async function saveDocumentAndChunks(
  org: Organization,
  docMeta: Omit<TenderDocument, 'orgId' | 'ownerId' | 'memberUids' | 'createdAt' | 'updatedAt'>,
  chunks: Array<{
    chunkIndex: number;
    pageNumber: number;
    sectionType: string;
    content: string;
    embedding: number[];
  }>,
): Promise<void> {
  const docPath = `organizations/${org.id}/documents/${docMeta.id}`;
  try {
    const docRecord: TenderDocument = {
      ...docMeta,
      orgId: org.id,
      ownerId: org.ownerId,
      memberUids: org.memberUids,
      fileName: docMeta.fileName.slice(0, 260),
      extractedPreview: (docMeta.extractedPreview || '').slice(0, 7900),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'organizations', org.id, 'documents', docMeta.id), docRecord);

    // Batch write chunks (each <= 4000 chars + embedding <= 4096 floats)
    const limited = chunks.slice(0, 45);
    for (let i = 0; i < limited.length; i += 20) {
      const batch = writeBatch(db);
      for (const ch of limited.slice(i, i + 20)) {
        const chunkId = makeSafeId(`chk_${ch.chunkIndex}`);
        const chunkDoc: DocumentChunk = {
          id: chunkId,
          orgId: org.id,
          ownerId: org.ownerId,
          memberUids: org.memberUids,
          documentId: docMeta.id,
          chunkIndex: ch.chunkIndex,
          pageNumber: ch.pageNumber,
          sectionType: (ch.sectionType || 'General').slice(0, 80),
          content: ch.content.slice(0, 3950),
          embedding: (ch.embedding || []).slice(0, 4096),
          createdAt: serverTimestamp(),
        };
        batch.set(
          doc(db, 'organizations', org.id, 'documents', docMeta.id, 'chunks', chunkId),
          chunkDoc,
        );
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, docPath);
  }
}

export async function fetchDocumentChunks(
  orgId: string,
  documentId: string,
  uid: string,
): Promise<DocumentChunk[]> {
  const path = `organizations/${orgId}/documents/${documentId}/chunks`;
  try {
    const q = query(
      collection(db, 'organizations', orgId, 'documents', documentId, 'chunks'),
      where('memberUids', 'array-contains', uid),
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as DocumentChunk)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

// --- Analysis, Eligibility, Proposal, Financial, Risk Persistence ---
export async function saveTenderAnalysis(
  org: Organization,
  analysis: Omit<TenderAnalysis, 'orgId' | 'ownerId' | 'memberUids' | 'createdAt' | 'updatedAt'>,
): Promise<void> {
  const path = `organizations/${org.id}/analyses/${analysis.id}`;
  try {
    const payload: TenderAnalysis = {
      ...analysis,
      orgId: org.id,
      ownerId: org.ownerId,
      memberUids: org.memberUids,
      executiveSummary: analysis.executiveSummary.slice(0, 7900),
      eligibilityCriteria: (analysis.eligibilityCriteria || []).slice(0, 40),
      technicalSpecs: (analysis.technicalSpecs || []).slice(0, 40),
      financialRequirements: (analysis.financialRequirements || []).slice(0, 30),
      importantDates: (analysis.importantDates || []).slice(0, 20),
      mandatoryDocuments: (analysis.mandatoryDocuments || []).slice(0, 40),
      disqualificationConditions: (analysis.disqualificationConditions || []).slice(0, 30),
      initialRisks: (analysis.initialRisks || []).slice(0, 30),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'organizations', org.id, 'analyses', analysis.id), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveEligibilityAssessment(
  org: Organization,
  assessment: Omit<EligibilityAssessment, 'orgId' | 'ownerId' | 'memberUids' | 'createdAt' | 'updatedAt'>,
): Promise<void> {
  const path = `organizations/${org.id}/eligibilities/${assessment.id}`;
  try {
    const payload: EligibilityAssessment = {
      ...assessment,
      orgId: org.id,
      ownerId: org.ownerId,
      memberUids: org.memberUids,
      summary: assessment.summary.slice(0, 3900),
      comparisons: (assessment.comparisons || []).slice(0, 40),
      missingDocuments: (assessment.missingDocuments || []).slice(0, 40),
      complianceGaps: (assessment.complianceGaps || []).slice(0, 30),
      disqualificationRisks: (assessment.disqualificationRisks || []).slice(0, 30),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'organizations', org.id, 'eligibilities', assessment.id), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveProposalRecord(
  org: Organization,
  proposal: Omit<GeneratedProposal, 'orgId' | 'ownerId' | 'memberUids' | 'createdAt' | 'updatedAt'>,
  isUpdate = false,
): Promise<void> {
  const path = `organizations/${org.id}/proposals/${proposal.id}`;
  try {
    if (isUpdate) {
      await updateDoc(doc(db, 'organizations', org.id, 'proposals', proposal.id), {
        title: proposal.title.slice(0, 300),
        currentVersion: proposal.currentVersion,
        sections: proposal.sections.slice(0, 20),
        complianceNotes: (proposal.complianceNotes || []).slice(0, 20),
        versions: (proposal.versions || []).slice(0, 15),
        updatedAt: serverTimestamp(),
      });
    } else {
      const payload: GeneratedProposal = {
        ...proposal,
        orgId: org.id,
        ownerId: org.ownerId,
        memberUids: org.memberUids,
        title: proposal.title.slice(0, 300),
        sections: proposal.sections.slice(0, 20),
        complianceNotes: (proposal.complianceNotes || []).slice(0, 20),
        versions: (proposal.versions || []).slice(0, 15),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'organizations', org.id, 'proposals', proposal.id), payload);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveFinancialAnalysis(
  org: Organization,
  fin: Omit<FinancialAnalysis, 'orgId' | 'ownerId' | 'memberUids' | 'createdAt' | 'updatedAt'>,
  isUpdate = false,
): Promise<void> {
  const path = `organizations/${org.id}/financials/${fin.id}`;
  try {
    if (isUpdate) {
      await updateDoc(doc(db, 'organizations', org.id, 'financials', fin.id), {
        tenderBudgetLakhs: fin.tenderBudgetLakhs,
        emdLakhs: fin.emdLakhs ?? 0,
        pbgPercent: fin.pbgPercent ?? 5,
        costInputs: fin.costInputs,
        scenarios: fin.scenarios.slice(0, 5),
        aiCommentary: (fin.aiCommentary || '').slice(0, 4900),
        recommendedBidLakhs: fin.recommendedBidLakhs ?? 0,
        updatedAt: serverTimestamp(),
      });
    } else {
      const payload: FinancialAnalysis = {
        ...fin,
        orgId: org.id,
        ownerId: org.ownerId,
        memberUids: org.memberUids,
        scenarios: fin.scenarios.slice(0, 5),
        aiCommentary: (fin.aiCommentary || '').slice(0, 4900),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'organizations', org.id, 'financials', fin.id), payload);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveRiskReport(
  org: Organization,
  risk: Omit<RiskReport, 'orgId' | 'ownerId' | 'memberUids' | 'createdAt' | 'updatedAt'>,
): Promise<void> {
  const path = `organizations/${org.id}/risks/${risk.id}`;
  try {
    const payload: RiskReport = {
      ...risk,
      orgId: org.id,
      ownerId: org.ownerId,
      memberUids: org.memberUids,
      executiveSummary: risk.executiveSummary.slice(0, 3900),
      risks: risk.risks.slice(0, 40),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'organizations', org.id, 'risks', risk.id), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveTeamMember(
  org: Organization,
  member: Omit<TeamMember, 'orgId' | 'ownerId' | 'memberUids' | 'createdAt' | 'updatedAt'>,
): Promise<void> {
  const path = `organizations/${org.id}/members/${member.id}`;
  try {
    const payload: TeamMember = {
      ...member,
      orgId: org.id,
      ownerId: org.ownerId,
      memberUids: org.memberUids,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'organizations', org.id, 'members', member.id), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateTeamMemberRole(
  orgId: string,
  memberId: string,
  role: TeamMember['role'],
): Promise<void> {
  const path = `organizations/${orgId}/members/${memberId}`;
  try {
    await updateDoc(doc(db, 'organizations', orgId, 'members', memberId), {
      role,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteTeamMember(orgId: string, memberId: string): Promise<void> {
  const path = `organizations/${orgId}/members/${memberId}`;
  try {
    await deleteDoc(doc(db, 'organizations', orgId, 'members', memberId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function logActivity(
  org: Organization,
  params: {
    actorUid: string;
    actorName: string;
    actionType: string;
    description: string;
    tenderId?: string;
  },
): Promise<void> {
  const id = makeSafeId('act');
  const path = `organizations/${org.id}/activities/${id}`;
  try {
    const entry: ActivityLog = {
      id,
      orgId: org.id,
      ownerId: org.ownerId,
      memberUids: org.memberUids,
      tenderId: params.tenderId || '',
      actorUid: params.actorUid,
      actorName: params.actorName.slice(0, 120),
      actionType: params.actionType.slice(0, 80),
      description: params.description.slice(0, 600),
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'organizations', org.id, 'activities', id), entry);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function createNotification(
  org: Organization,
  params: {
    tenderId?: string;
    title: string;
    message: string;
    severity: NotificationItem['severity'];
  },
): Promise<void> {
  const id = makeSafeId('ntf');
  const path = `organizations/${org.id}/notifications/${id}`;
  try {
    const ntf: NotificationItem = {
      id,
      orgId: org.id,
      ownerId: org.ownerId,
      memberUids: org.memberUids,
      tenderId: params.tenderId || '',
      title: params.title.slice(0, 200),
      message: params.message.slice(0, 600),
      severity: params.severity,
      isRead: false,
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'organizations', org.id, 'notifications', id), ntf);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function markNotificationRead(orgId: string, notificationId: string): Promise<void> {
  const path = `organizations/${orgId}/notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'organizations', orgId, 'notifications', notificationId), {
      isRead: true,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// Seed clearly marked DEMO DATA records into a newly initialized workspace
export async function seedDemoWorkspaceData(
  org: Organization,
  actorUid: string,
  actorName: string,
): Promise<void> {
  const demoTender1Id = makeSafeId('tnd_demo');
  const demoTender2Id = makeSafeId('tnd_demo');
  const demoTender3Id = makeSafeId('tnd_demo');

  await saveTenderRecord(org, {
    id: demoTender1Id,
    referenceNumber: 'GEM/2026/B/5192044 (DEMO DATA)',
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
    status: 'Bid Preparation',
    eligibilityStatus: 'Potentially Eligible',
    assignedToUid: actorUid,
    assignedToName: actorName,
    reminderEnabled: true,
    isSaved: true,
    summary:
      'Turnkey SCADA instrumentation, 120 ultrasonic flow meters, RTUs, and cloud predictive leak analytics hosted on MeitY-empanelled infrastructure.',
    checklist: [
      { id: 'chk_1', label: 'Audited Financial Statements (3 FYs)', completed: true, required: true },
      { id: 'chk_2', label: 'ISO 9001:2015 & ISO 27001:2022 Certificates', completed: true, required: true },
      { id: 'chk_3', label: 'EMD e-BG / Udyam Exemption Certificate', completed: false, required: true },
      { id: 'chk_4', label: 'Non-Blacklisting Affidavit (INR 100 Stamp)', completed: false, required: true },
    ],
  });

  await saveTenderRecord(org, {
    id: demoTender2Id,
    referenceNumber: 'CPPP/MSME/2026/ERP-029 (DEMO DATA)',
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
    status: 'Eligibility Checking',
    eligibilityStatus: 'Eligible',
    assignedToUid: actorUid,
    assignedToName: actorName,
    reminderEnabled: true,
    isSaved: true,
    summary:
      'Cloud-native multilingual portal and analytics workspace for 140 MSME cluster centers with EMD exemption for Udyam MSMEs.',
    checklist: [
      { id: 'chk_a', label: 'Udyam MSME Registration Certificate', completed: true, required: true },
      { id: 'chk_b', label: 'Past Government SaaS Work Orders', completed: true, required: true },
      { id: 'chk_c', label: 'Technical Compliance Matrix Sign-off', completed: false, required: true },
    ],
  });

  await saveTenderRecord(org, {
    id: demoTender3Id,
    referenceNumber: 'GEM/2026/B/5148920 (DEMO DATA)',
    title: 'Enterprise Cloud SOC & Zero-Trust Network Modernization for State Secretariat',
    authority: 'State Directorate of Information Technology',
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
    status: 'Under Review',
    eligibilityStatus: 'Not Checked',
    assignedToUid: actorUid,
    assignedToName: actorName,
    reminderEnabled: false,
    isSaved: true,
    summary:
      '24x7 managed SOC operations, SIEM/SOAR deployment, and CERT-In compliance across 42 state department portals.',
    checklist: [
      { id: 'chk_x', label: 'CERT-In Empanelment Verification', completed: false, required: true },
      { id: 'chk_y', label: 'Bid Security Declaration', completed: false, required: true },
    ],
  });

  await saveTenderAnalysis(org, {
    id: makeSafeId('anl_demo'),
    tenderId: demoTender1Id,
    executiveSummary:
      'DEMO DATA: Turnkey procurement for 120 ultrasonic flow meters, RTUs, and a centralized cloud SCADA analytics platform with a 36-month O&M contract. Estimated value is INR 480 Lakhs with 2% EMD (INR 9.60 Lakhs) and 5% PBG.',
    tenderMetadata: {
      referenceNumber: 'GEM/2026/B/5192044 (DEMO DATA)',
      issuingAuthority: 'Municipal Water & Sewerage Board',
      estimatedValue: 'INR 480.00 Lakhs',
      emdRequirement: 'INR 9.60 Lakhs (2%) via BG / e-BG (MSME exemption subject to Udyam verification)',
      tenderFee: 'INR 11,800 (Incl. GST)',
      performanceSecurity: '5% of Contract Value within 15 days of LOA',
      submissionDeadline: '2026-12-28 15:00 IST',
      bidValidityDays: '120 Days',
    },
    eligibilityCriteria: [
      {
        item: 'Minimum Average Annual Turnover of INR 350 Lakhs over last 3 FYs',
        category: 'Financial',
        mandatory: true,
        sourcePage: 'Page 2 (Demo)',
        evidenceQuote: 'Minimum Average Annual Turnover of INR 350.00 Lakhs over FY 2023-24 to FY 2025-26.',
      },
      {
        item: '2 completed Government SCADA / IoT Telemetry projects >= INR 150 Lakhs each',
        category: 'Experience',
        mandatory: true,
        sourcePage: 'Page 2 (Demo)',
        evidenceQuote: 'At least 2 completed Government / Municipal SCADA or Enterprise Cloud Monitoring projects >= INR 150 Lakhs.',
      },
    ],
    technicalSpecs: [
      {
        item: '99.5% monthly cloud SCADA dashboard availability SLA',
        category: 'SLA',
        mandatory: true,
        sourcePage: 'Page 3 (Demo)',
        evidenceQuote: 'Minimum 99.5% monthly availability measured across central dashboard.',
      },
    ],
    financialRequirements: [
      {
        item: '50% hardware delivery, 30% Go-Live UAT, 20% quarterly O&M over 36 months',
        category: 'Payment Terms',
        mandatory: true,
        sourcePage: 'Page 3 (Demo)',
        evidenceQuote: 'No mobilization advance is payable.',
      },
    ],
    importantDates: [
      {
        event: 'Pre-Bid Clarification Meeting',
        dateValue: '2026-12-10 11:00 IST',
        sourcePage: 'Page 1 (Demo)',
        evidenceQuote: 'Pre-Bid Meeting: 2026-12-10 11:00 IST',
      },
      {
        event: 'Final Bid Submission Deadline',
        dateValue: '2026-12-28 15:00 IST',
        sourcePage: 'Page 1 (Demo)',
        evidenceQuote: 'Last Date for Bid Submission: 2026-12-28 15:00 IST',
      },
    ],
    mandatoryDocuments: [
      {
        item: 'ISO 9001:2015, ISO/IEC 27001:2022, and Non-Blacklisting Affidavit',
        category: 'Compliance',
        mandatory: true,
        sourcePage: 'Page 2 (Demo)',
        evidenceQuote: 'Non-Blacklisting Affidavit on INR 100 Stamp Paper.',
      },
    ],
    disqualificationConditions: [
      {
        item: 'Conditional bids or missing EMD / unsigned Annexures lead to summary rejection',
        category: 'Disqualification',
        mandatory: true,
        sourcePage: 'Page 3 (Demo)',
        evidenceQuote: 'Conditional bids, unsigned Annexures, or missing EMD lead to rejection.',
      },
    ],
    initialRisks: [
      {
        clause: 'Liquidated Damages at 0.5% per week capped at 10% for commissioning beyond 16 weeks',
        severity: 'High',
        sourcePage: 'Page 3 (Demo)',
        evidenceQuote: 'Delay beyond 16 weeks attracts LD at 0.5% per week up to 10%.',
      },
    ],
  });

  await createNotification(org, {
    tenderId: demoTender2Id,
    title: 'Approaching Bid Deadline (DEMO DATA)',
    message: 'CPPP/MSME/2026/ERP-029 submission closes on 2026-12-16. Review technical compliance matrix.',
    severity: 'warning',
  });

  await logActivity(org, {
    actorUid,
    actorName,
    tenderId: demoTender1Id,
    actionType: 'WORKSPACE_INITIALIZED',
    description: 'Initialized organization workspace with clearly labeled DEMO DATA tender records.',
  });
}
