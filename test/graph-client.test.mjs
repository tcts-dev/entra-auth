import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveGraphUrl } from '../dist/graph/client.js';

test('resolveGraphUrl keeps relative paths on Microsoft Graph v1.0', () => {
  assert.equal(
    resolveGraphUrl('/users?$top=1'),
    'https://graph.microsoft.com/v1.0/users?$top=1',
  );
});

test('resolveGraphUrl allows Microsoft Graph nextLink URLs', () => {
  assert.equal(
    resolveGraphUrl('https://graph.microsoft.com/v1.0/users?$skiptoken=abc'),
    'https://graph.microsoft.com/v1.0/users?$skiptoken=abc',
  );
});

test('resolveGraphUrl allows Microsoft Graph URLs with explicit HTTPS port', () => {
  assert.equal(
    resolveGraphUrl('https://graph.microsoft.com:443/v1.0/users'),
    'https://graph.microsoft.com/v1.0/users',
  );
});

test('resolveGraphUrl rejects non-Graph HTTPS URLs', () => {
  assert.throws(
    () => resolveGraphUrl('https://example.com/users'),
    /refusing to send token to non-Graph URL/,
  );
});

test('resolveGraphUrl rejects non-HTTPS absolute URLs as non-Graph URLs', () => {
  assert.throws(
    () => resolveGraphUrl('http://graph.microsoft.com/v1.0/users'),
    /refusing to send token to non-Graph URL/,
  );
});

test('resolveGraphUrl normalizes malformed Graph URL errors', () => {
  assert.throws(() => resolveGraphUrl('https://%'), /invalid Graph URL/);
});

test('resolveGraphUrl rejects malformed relative paths', () => {
  assert.throws(
    () => resolveGraphUrl('users'),
    /relative paths must start with "\/"/,
  );
});
