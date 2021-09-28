const Parser = require('binary-parser').Parser;

const ipHeader = new Parser()
  .int32le('len_config')
  .buffer('config', { length: 'len_config' })
  .int32le('len_data_send');

const getObjectFromConfigBuffer = buffer => {
  const query = buffer.toString('utf8');
  const items = query.split(',');
  const object = {};
  for (let item of items) {
    const [key, value] = item.split('=');
    if (key && value) {
      object[key] = value;
    }
  }
  return object;
};

module.exports = { ipHeader, getObjectFromConfigBuffer };
