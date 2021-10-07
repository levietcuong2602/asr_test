const axios = require('axios');

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

const httpGET = async ({
  url,
  params,
  headers = { 'content-type': 'application/json' },
}) => {
  try {
    const data = await axios
      .get(url, { params, headers })
      .then(res => res.text())
      .catch(err => {
        console.log(err.message);
        return '';
      });
    return data;
  } catch (error) {
    return '';
  }
};

const httpPOST = async ({
  url,
  body,
  headers = { 'content-type': 'application/json' },
}) => {
  try {
    const data = await axios
      .post(url, body, { headers })
      .then(res => res.json())
      .catch(err => {
        console.log(err.message);
        return '';
      });
    return data;
  } catch (err) {
    return '';
  }
};

module.exports = { cleanGarbageTimeout, saveVariableGlobal, httpGET, httpPOST };
