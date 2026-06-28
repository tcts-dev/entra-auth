import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createUser } from '../dist/graph/user-management.js';

test('createUser generates an Entra-compatible initial password shape', async () => {
  let requestBody;
  const client = {
    async getToken() {
      throw new Error('not used');
    },
    async callGraph(method, path, body) {
      requestBody = body;
      assert.equal(method, 'POST');
      assert.equal(path, '/users');
      return {
        id: 'user-id',
        displayName: body.displayName,
        mail: body.mail,
        userPrincipalName: body.mail,
        accountEnabled: true,
        identities: body.identities,
      };
    },
  };

  await createUser(client, {
    email: 'contractor@example.com',
    displayName: 'Contractor Example',
  });

  const password = requestBody?.passwordProfile?.password;
  assert.equal(typeof password, 'string');
  assert.equal(password.length, 12);
  assert.match(password, /[ABCDEFGHJKLMNPQRSTUVWXYZ]/);
  assert.match(password, /[abcdefghjkmnpqrstuvwxyz]/);
  assert.match(password, /[23456789]/);
  assert.match(password, /[!@#$%^&*]/);
  assert.equal(requestBody.passwordProfile.forceChangePasswordNextSignIn, true);
});
