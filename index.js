const fs = require("fs");

const { VbeeSpeech } = require("./vbee");
const { VaisSpeech } = require("./vais");
const { PROVIDER } = require("./constants");
// test stt vbee
const ServiceSpeech = (provider) => {
  switch (provider) {
    case PROVIDER.VBEE:
      return new VbeeSpeech();
    case PROVIDER.VAIS:
      return new VaisSpeech();
    default:
      return null;
  }
};

const test = ServiceSpeech(PROVIDER.VAIS);

const audioDataStream = fs.createReadStream("./test.wav", {
  highWaterMark: 320,
});
audioDataStream.on("data", (chunk) => {
  test.recognizeStream.write({ audio_content: chunk });
});

audioDataStream.on("end", () => {
  test.recognizeStream.end();
});

// fs.readFile("./test_01.raw", function (err, data) {
//   if (err) throw err;
//   console.log({ data });
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
