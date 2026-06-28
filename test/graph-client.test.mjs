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

test('resolveGraphUrl rejects non-Graph HTTPS URLs', () => {
  assert.throws(
    () => resolveGraphUrl('https://example.com/users'),
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
