import assert from 'node:assert/strict';
import test from 'node:test';
import { chunkPages, cosineSimilarity, buildSampleTenderPdfBytes } from './server/ai/pdfAndRag.ts';
import { filterDiscoveryTenders } from './server/services/discoveryService.ts';
import { generateProposalDocx, generateProposalPdf } from './server/services/exportService.ts';

test('Semantic chunking preserves page numbers and section labels', () => {
  const chunks = chunkPages([
    {
      pageNumber: 1,
      text: 'Earnest Money Deposit (EMD) INR 9.60 Lakhs and Tender Fee INR 11,800 required prior to submission deadline.',
    },
    {
      pageNumber: 2,
      text: 'Bidder must have minimum average annual turnover of INR 350 Lakhs and valid ISO 27001 certification.',
    },
  ]);

  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].pageNumber, 1);
  assert.equal(chunks[0].sectionType, 'Financial');
  assert.equal(chunks[1].pageNumber, 2);
  assert.equal(chunks[1].sectionType, 'Eligibility');
});

test('Cosine similarity ranks identical vectors at 1.0 and orthogonal vectors at 0.0', () => {
  assert.ok(Math.abs(cosineSimilarity([1, 0, 0], [1, 0, 0]) - 1) < 1e-6);
  assert.ok(Math.abs(cosineSimilarity([1, 0, 0], [0, 1, 0])) < 1e-6);
});

test('Tender discovery filtering respects budget, turnover, and DEMO DATA labeling', () => {
  const results = filterDiscoveryTenders({
    industry: 'Water',
    maxBudgetLakhs: 500,
    maxTurnoverLakhs: 400,
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].sourceType, 'DEMO_DATA');
});

test('Sample PDF generation and DOCX/PDF proposal export produce valid binary payloads', async () => {
  const samplePdf = await buildSampleTenderPdfBytes();
  assert.equal(Buffer.from(samplePdf.subarray(0, 5)).toString('ascii'), '%PDF-');

  const docxBuf = await generateProposalDocx({
    title: 'Technical Proposal Test',
    tenderTitle: 'Smart SCADA RFP',
    tenderReference: 'GEM/2026/TEST/01',
    authority: 'Municipal Board',
    organizationName: 'Test Bidder Pvt Ltd',
    version: 1,
    sections: [{ heading: 'Executive Summary', content: 'Verified technical approach.' }],
  });
  assert.ok(docxBuf.length > 1000);

  const pdfBytes = await generateProposalPdf({
    title: 'Technical Proposal Test',
    tenderTitle: 'Smart SCADA RFP',
    tenderReference: 'GEM/2026/TEST/01',
    authority: 'Municipal Board',
    organizationName: 'Test Bidder Pvt Ltd',
    version: 1,
    sections: [{ heading: 'Executive Summary', content: 'Verified technical approach.' }],
  });
  assert.equal(Buffer.from(pdfBytes.subarray(0, 5)).toString('ascii'), '%PDF-');
});
