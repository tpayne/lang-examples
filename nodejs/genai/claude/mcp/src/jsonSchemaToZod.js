const { z } = require('zod');

/**
 * Converts one property of the simplified JSON-schema-style parameter
 * metadata used by this project (see mcpToolDefinitions.js) into a Zod type.
 * This only needs to support the small subset of JSON Schema actually used
 * in those definitions: string/number/boolean/array/object, enum, items,
 * nested properties/required, nullable and description.
 * @param {object} propSchema The JSON-schema-style definition for one property.
 * @returns {import('zod').ZodTypeAny} The equivalent Zod schema.
 */
function jsonSchemaPropToZod(propSchema) {
  const {
    type, enum: enumValues, items, properties, required, nullable, description,
  } = propSchema;

  let zodType;
  if (Array.isArray(enumValues) && enumValues.length > 0) {
    zodType = z.enum(enumValues);
  } else if (type === 'string') {
    zodType = z.string();
  } else if (type === 'number' || type === 'integer') {
    zodType = z.number();
  } else if (type === 'boolean') {
    zodType = z.boolean();
  } else if (type === 'array') {
    zodType = z.array(items ? jsonSchemaPropToZod(items) : z.unknown());
  } else if (type === 'object') {
    if (properties) {
      const requiredList = required || [];
      const shape = {};
      Object.entries(properties).forEach(([key, nestedSchema]) => {
        const nestedZod = jsonSchemaPropToZod(nestedSchema);
        shape[key] = requiredList.includes(key) ? nestedZod : nestedZod.optional();
      });
      zodType = z.object(shape);
    } else {
      zodType = z.record(z.string(), z.unknown());
    }
  } else {
    zodType = z.unknown();
  }

  if (description) {
    zodType = zodType.describe(description);
  }
  if (nullable) {
    zodType = zodType.nullable();
  }
  return zodType;
}

/**
 * Builds a Zod object shape (suitable for `z.object(shape)`) from the
 * `parametersSchema` + `required` pair used throughout mcpToolDefinitions.js
 * (the same shape that used to be handed straight to Claude as an
 * `input_schema`). Properties not listed in `required` become optional.
 * @param {Record<string, object>} parametersSchema Map of property name -> JSON-schema-style definition.
 * @param {string[]} [required] Names of properties that are required.
 * @returns {Record<string, import('zod').ZodTypeAny>} A shape object for `z.object()`.
 */
function buildZodShape(parametersSchema, required = []) {
  const shape = {};
  Object.entries(parametersSchema || {}).forEach(([key, propSchema]) => {
    const zodType = jsonSchemaPropToZod(propSchema);
    shape[key] = required.includes(key) ? zodType : zodType.optional();
  });
  return shape;
}

module.exports = { jsonSchemaPropToZod, buildZodShape };
