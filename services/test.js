const fs = require('fs');

const { ServiceSpeech } = require('../speech');
const { PROVIDER } = require('../constants');

const testSpeech = () => {
  const test = ServiceSpeech(PROVIDER.VBEE);

  const audioDataStream = fs.createReadStream('./audio_237.wav', {
    highWaterMark: 320,
  });

  audioDataStream.on('data', (chunk) => {
    test.recognizeStream.write({ audio_content: chunk });
  });

  audioDataStream.on('end', () => {
    test.recognizeStream.end();
  });

  // fs.readFile("./test_01.raw", function (err, data) {
  //   if (err) throw err;
  //   let count = 0;
  //   const chunkSize = 640;
  //   for (var i = 0; i < data.length; i += chunkSize) {
  //     buffer = data.slice(i, Math.min(i + chunkSize, data.length));
  //     request = {
  //       audio_content: buffer,
  //     };
  //     count += 1;

  //     test.recognizeStream.write(request);
  //   }
  //   console.log("count", count);
  //   test.recognizeStream.end();
  // });
};

module.exports = {
  testSpeech,
};
