const {
  PORT,

  REDIS_PORT = 6379,
  REDIS_HOST,
  REDIS_PASSWORD,
} = process.env;

module.exports = {
  PORT: PORT || 3000,
  REDIS_PORT,
  REDIS_HOST,
  REDIS_PASSWORD,
};
