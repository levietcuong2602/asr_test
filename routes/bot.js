const router = require('express').Router();

const wrapAsync = require('../middlewares/wrapAsync');
const botControler = require('../controllers/bot');
const { initBotValidate, closeBotValidate } = require('../validations/bot');

router.get('/bot/init', initBotValidate, wrapAsync(botControler.initBot));
router.get('/bot/close', closeBotValidate, wrapAsync(botControler.closeBot));

module.exports = router;
