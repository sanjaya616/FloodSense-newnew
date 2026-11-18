/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stripDataUrlPrefix,
  getBase64DecodedByteLength,
  estimateFirestoreEvidenceDocBytes,
  base64ToImageUrl,
  revokeImageUrl,
  validateReportImage,
  MAX_FIRESTORE_EVIDENCE_DOC_BYTES,
  MAX_ORIGINAL_IMAGE_BYTES,
} from './imageUtils';

test('stripDataUrlPrefix removes data:image headers and whitespace cleanly', () => {
  const raw = 'data:image/jpeg;base64,/9j/4AAQ\nSkZJRg==  ';
  assert.equal(stripDataUrlPrefix(raw), '/9j/4AAQSkZJRg==');
  assert.equal(stripDataUrlPrefix('/9j/4AAQ'), '/9j/4AAQ');
});

test('getBase64DecodedByteLength calculates exact decoded byte count with padding', () => {
  const bytes = Buffer.from('FloodSense-Spark-Evidence-Payload', 'utf8');
  const b64 = bytes.toString('base64');
  assert.equal(getBase64DecodedByteLength(b64), bytes.length);
  assert.equal(getBase64DecodedByteLength(`data:image/jpeg;base64,${b64}`), bytes.length);
  assert.equal(getBase64DecodedByteLength(''), 0);
});

test('estimateFirestoreEvidenceDocBytes stays well under 1 MiB for compressed JPEG payloads', () => {
  // ~450 KB binary -> ~600 KB base64 -> ~601 KiB total doc (< 850 KiB limit)
  const sampleBinary = Buffer.alloc(450 * 1024, 0xab);
  const base64Data = sampleBinary.toString('base64');
  const estimated = estimateFirestoreEvidenceDocBytes({
    ownerUid: 'uid-citizen-123456',
    mimeType: 'image/jpeg',
    base64Data,
    fileName: 'flood_road.jpg',
    byteSize: sampleBinary.length,
    width: 1280,
    height: 720,
    createdAt: '2026-11-16T08:00:00.000Z',
  });

  assert.ok(estimated < MAX_FIRESTORE_EVIDENCE_DOC_BYTES, `Expected ${estimated} < ${MAX_FIRESTORE_EVIDENCE_DOC_BYTES}`);
  assert.ok(estimated > base64Data.length);
});

test('base64ToImageUrl and revokeImageUrl convert raw base64 safely without data: prefix bugs', () => {
  const sampleB64 = Buffer.from('hello-flood-image', 'utf8').toString('base64');
  const url = base64ToImageUrl(sampleB64, 'image/jpeg');
  assert.ok(url.startsWith('blob:') || url.startsWith('data:image/jpeg;base64,'));
  assert.doesNotThrow(() => revokeImageUrl(url));
  assert.equal(base64ToImageUrl('', 'image/jpeg'), '');
});

test('validateReportImage rejects corrupt non-image files, empty blobs, and > 10 MB uploads', async () => {
  const emptyRes = await validateReportImage(new Blob(['tiny'], { type: 'image/jpeg' }));
  assert.equal(emptyRes.valid, false);

  const textSpoof = new Blob(['NOT_A_REAL_JPEG_HEADER_0123456789ABCDEF'], { type: 'image/jpeg' });
  const spoofRes = await validateReportImage(textSpoof);
  assert.equal(spoofRes.valid, false);
  assert.match(spoofRes.error || '', /corrupt|unsupported/i);

  const validJpeg = new Uint8Array(64);
  validJpeg[0] = 0xff;
  validJpeg[1] = 0xd8;
  validJpeg[2] = 0xff;
  validJpeg[3] = 0xe0;
  const okRes = await validateReportImage(new Blob([validJpeg], { type: 'image/jpeg' }));
  assert.equal(okRes.valid, true);
  assert.equal(okRes.detectedMime, 'image/jpeg');

  const fakeOversizedBlob = {
    size: MAX_ORIGINAL_IMAGE_BYTES + 1024,
    type: 'image/jpeg',
    slice: () => new Blob([validJpeg]),
  } as unknown as Blob;
  const tooLargeRes = await validateReportImage(fakeOversizedBlob);
  assert.equal(tooLargeRes.valid, false);
  assert.match(tooLargeRes.error || '', /10 MB/i);
});
