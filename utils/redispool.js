var redis = require('redis');
var bluebird = require('bluebird');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const delay = ms => new Promise(res => setTimeout(res, ms));

/**
 * RedisPool singleton class
 */
class RedisPool {
  /**
   * Maximum connection of pool.
   *
   * @return {Number} maximum connection of pool
   */
  static getMaxConnections() {
    return this.maxConnections;
  }

  /**
   * pool init.
   *
   * @param  {object} options redis options,
   * add maxConnections to create the number of client
   * @return {RedisPool}  return this
   */
  static init(options = undefined) {
    this.maxConnections = options.maxConnections;

    //client collection pool
    this.pool = Array(options.maxConnections)
      .fill(null)
      .map(() => redis.createClient(options));

    //list of waiting task request redis client
    this.waitingTasks = [];

    //add some userful function to redis client
    this.pool.forEach(rd => {
      /**
       * Get value and convert it to integer from redis
       *
       * @param {String} key redis key
       * @param {Number} defaultValue default value if key not exists
       * @return {Number}
       */
      rd.getIntAsync = async function(key, defaultValue = 0) {
        let value = await rd.getAsync(key);
        return parseInt(value || defaultValue);
      };

      /**
       * Get value and convert it to float from redis
       *
       * @param {String} key redis key
       * @param {Number} defaultValue default value if key not exists
       * @return {Number}
       */
      rd.getFloatAsync = async function(key, defaultValue = 0.0) {
        let value = await rd.getAsync(key);
        return parseFloat(value || defaultValue);
      };

      /**
       * Get value and convert it to Object from redis
       *
       * @param {String} key redis key
       * @return {Object}
       */
      rd.getJSONAsync = async function(key) {
        return await rd
          .getAsync(key)
          .then(val => (val ? JSON.parse(val) : val));
      };

      /**
       * release redis client
       */
      rd.release = function() {
        RedisPool.release(rd);
      };
    });

    //wrapper all client query commands
    Object.getOwnPropertyNames(redis.RedisClient.prototype)
      .filter(name => name.endsWith('Async'))
      .forEach(name => {
        this[name] = (...args) => this.command(name, ...args);
      });

    return this;
  }

  /**
   * wrapper client query command.
   * This function pop one client, query command with
   * this client and push it back to pool
   *
   * @param  {String}    name the name of command
   * @param  {...any} args arguments of command
   * @return {Promise<RedisClient>}         [description]
   */
  static async command(name, ...args) {
    let rd = await this.getClient(false);
    try {
      let ret = await rd[name](...args);
      this.release(rd);
      return ret;
    } catch (err) {
      this.release(rd);
      throw err;
    }
  }

  /**
   * @brief pop one client.
   *
   * This function wait until get and pop one connection.
   *
   * @param  {Number} msAutoRelease      wating time for auto release
   * @return {Promise<RedisClient>}            redis client
   */
  static getClient(msAutoRelease = 500) {
    return new Promise(resolve => {
      if (this.pool.length) {
        let rd = this.pool.pop();
        setTimeout(() => this.release(rd), msAutoRelease);
        resolve(rd);
      } else {
        this.waitingTasks.push({
          resolve,
          msAutoRelease,
        });
      }
    });

    // //wait until pool has at least one connection
    // while (!this.pool.length)
    //     await delay(msWaitStep);

    // let rd = this.pool.pop();

    // if (msAutoRelease)
    //     setTimeout(() => this.release(rd), msAutoRelease);

    // return rd;
  }

  /**
   * push client to pool
   *
   * @param  {RedisClient} client The client be released to pool
   */
  static release(client) {
    if (this.pool.includes(client)) return;
    if (!this.waitingTasks.length) {
      this.pool.push(client);
      return;
    }

    let { resolve, msAutoRelease } = this.waitingTasks.pop();
    resolve(client);
    if (msAutoRelease) setTimeout(() => this.release(rd), msAutoRelease);
  }
}

RedisPool.pop = RedisPool.getClient;
RedisPool.push = RedisPool.release;
const redis_config = {
  port: 6379,
  host: process.env.redis_host || 'mrcp_speech_to_text_redis',
  options: {},
  // password: '',
  maxConnections: 150,
  handleRedisError: true,
};

RedisPool.init(redis_config);

module.exports = RedisPool;
