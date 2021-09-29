const redis = require('redis');
const bluebird = require('bluebird');

const { REDIS_PORT, REDIS_HOST, REDIS_PASSWORD } = require('../configs');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const client = redis.createClient({
  port: REDIS_PORT,
  host: REDIS_HOST,
  password: REDIS_PASSWORD || '',
});

client.on('error', err => {
  console.error('REDIS_ERROR: ', err);
});

const publisher = redis.createClient({
  port: REDIS_PORT,
  host: REDIS_HOST,
  password: REDIS_PASSWORD || '',
});

const subscriber = () =>
  redis.createClient({
    port: REDIS_PORT,
    host: REDIS_HOST,
    password: REDIS_PASSWORD || '',
  });

module.exports = { client, publisher, subscriber };
