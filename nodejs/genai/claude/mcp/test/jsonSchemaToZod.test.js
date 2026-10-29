const assert = require('node:assert/strict');
const { test, describe } = require('node:test');

const { jsonSchemaPropToZod, buildZodShape } = require('../src/jsonSchemaToZod');

describe('jsonSchemaPropToZod', () => {
  test('converts a string property', () => {
    const zodType = jsonSchemaPropToZod({ type: 'string', description: 'a name' });
    assert.equal(zodType.parse('hello'), 'hello');
    assert.throws(() => zodType.parse(42));
  });

  test('converts number and integer properties', () => {
    assert.equal(jsonSchemaPropToZod({ type: 'number' }).parse(3.14), 3.14);
    assert.equal(jsonSchemaPropToZod({ type: 'integer' }).parse(42), 42);
    assert.throws(() => jsonSchemaPropToZod({ type: 'number' }).parse('not a number'));
  });

  test('converts a boolean property', () => {
    assert.equal(jsonSchemaPropToZod({ type: 'boolean' }).parse(true), true);
    assert.throws(() => jsonSchemaPropToZod({ type: 'boolean' }).parse('true'));
  });

  test('converts an enum property, rejecting values outside the set', () => {
    const zodType = jsonSchemaPropToZod({ type: 'string', enum: ['driving', 'walking'] });
    assert.equal(zodType.parse('driving'), 'driving');
    assert.throws(() => zodType.parse('flying'));
  });

  test('converts an array property using the nested items schema', () => {
    const zodType = jsonSchemaPropToZod({
      type: 'array',
      items: { type: 'string', enum: ['tables', 'views'] },
    });
    assert.deepEqual(zodType.parse(['tables', 'views']), ['tables', 'views']);
    assert.throws(() => zodType.parse(['tables', 'bogus']));
  });

  test('converts a nested object property, making only its own required fields mandatory', () => {
    const zodType = jsonSchemaPropToZod({
      type: 'object',
      properties: {
        origin: { type: 'string' },
        destination: { type: 'string' },
        mode: { type: 'string', enum: ['driving', 'walking'] },
      },
      required: ['origin', 'destination'],
    });

    assert.deepEqual(
      zodType.parse({ origin: 'A', destination: 'B' }),
      { origin: 'A', destination: 'B' },
    );
    assert.throws(() => zodType.parse({ origin: 'A' })); // missing destination
    assert.throws(() => zodType.parse({ origin: 'A', destination: 'B', mode: 'flying' }));
  });

  test('converts an object property with no declared properties to a free-form record', () => {
    const zodType = jsonSchemaPropToZod({ type: 'object', description: 'arbitrary inputs' });
    assert.deepEqual(zodType.parse({ anything: 1, goes: 'here' }), { anything: 1, goes: 'here' });
  });

  test('a nullable property accepts null', () => {
    const zodType = jsonSchemaPropToZod({ type: 'string', nullable: true });
    assert.equal(zodType.parse(null), null);
  });

  test('an unrecognized type falls back to accepting anything', () => {
    const zodType = jsonSchemaPropToZod({ description: 'no type given' });
    assert.equal(zodType.parse('anything'), 'anything');
  });
});

describe('buildZodShape', () => {
  test('required properties are mandatory; everything else is optional', () => {
    const shape = buildZodShape(
      {
        username: { type: 'string' },
        repoName: { type: 'string' },
        branchName: { type: 'string' },
      },
      ['username', 'repoName'],
    );
    const { z } = require('zod');
    const schema = z.object(shape);

    assert.deepEqual(
      schema.parse({ username: 'alex', repoName: 'repo' }),
      { username: 'alex', repoName: 'repo' },
    );
    assert.throws(() => schema.parse({ repoName: 'repo' })); // missing required username
  });

  test('defaults required to none when omitted, making every property optional', () => {
    const { z } = require('zod');
    const shape = buildZodShape({ namespace: { type: 'string' } });
    const schema = z.object(shape);
    assert.deepEqual(schema.parse({}), {});
  });

  test('handles an empty parametersSchema (tools with no parameters)', () => {
    const { z } = require('zod');
    const shape = buildZodShape({}, []);
    const schema = z.object(shape);
    assert.deepEqual(schema.parse({}), {});
  });
});
