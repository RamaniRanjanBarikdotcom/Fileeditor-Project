const test = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');

const { ValidationPipe } = require('@nestjs/common');
const { UpdateProfileDto, UpdatePreferencesDto } = require('../dist/users/users.controller');
const { UsersService } = require('../dist/users/users.service');

// Same options as main.ts.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const validate = (metatype, value) => pipe.transform(value, { type: 'body', metatype });

test('profile updates reject privileged fields such as platformRole and status', async () => {
  await assert.rejects(validate(UpdateProfileDto, { firstName: 'A', platformRole: 'ADMIN' }));
  await assert.rejects(validate(UpdateProfileDto, { status: 'SUSPENDED' }));
  await assert.rejects(validate(UpdateProfileDto, { email: 'other@example.com' }));
  assert.equal((await validate(UpdateProfileDto, { firstName: 'Ada' })).firstName, 'Ada');
});

test('the service writes only editable profile fields even if given more', async () => {
  let written;
  const service = new UsersService({
    user: { update: async (input) => ((written = input.data), {}) },
  });
  await service.updateProfile('user-1', { firstName: 'Ada', platformRole: 'ADMIN' });
  assert.deepEqual(written, { firstName: 'Ada', lastName: undefined });
});

test('only known Blog Studio themes can be saved', async () => {
  for (const theme of ['cobalt', 'forest', 'sunset', 'midnight']) {
    assert.equal((await validate(UpdatePreferencesDto, { blogStudioTheme: theme })).blogStudioTheme, theme);
  }
  await assert.rejects(validate(UpdatePreferencesDto, { blogStudioTheme: 'neon' }));
  await assert.rejects(validate(UpdatePreferencesDto, {}));
  await assert.rejects(validate(UpdatePreferencesDto, { blogStudioTheme: 'forest', platformRole: 'ADMIN' }));
});
