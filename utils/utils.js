const cleanGarbageTimeout = (variable, field) => {
  setTimeout(() => {
    delete variable[field];
  }, 10 * 60 * 1000);
};

const saveVariableGlobal = (variable, field, value) => {
  if (!variable) variable = {};

  variable[field] = value;
  cleanGarbageTimeout(variable, field);
};

module.exports = { cleanGarbageTimeout, saveVariableGlobal };
