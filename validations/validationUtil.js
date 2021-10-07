const { validate } = require('express-validation');

const validateOptionDefault = {
  context: true,
  keyByField: true,
};

const customValidate = (schema, options, joiOptions) => {
  return validate(schema, { ...validateOptionDefault, ...options }, joiOptions);
};

module.exports = {
  customValidate,
};
