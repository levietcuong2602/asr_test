// const speech = require('@google-cloud/speech');
const fs = require('fs');

// require('dotenv').config();
// // Import node-record-lpcm16 để ghi lại âm thanh
// // Nếu chưa có chạy npm install node-record-lpcm16 để cài đặt
// const recorder = require('node-record-lpcm16');

// const client = new speech.SpeechClient({
//   keyFilename: './credential_google.json',
// });

// const encoding = 'LINEAR16';
// const sampleRateHertz = 16000;
// const languageCode = 'vi-VN';

// const request = {
//   config: {
//     encoding: encoding,
//     sampleRateHertz: sampleRateHertz,
//     languageCode: languageCode,
//   },
//   interimResults: false,
// };
// // // Tạo luồng nhận dạng
// // const recognizeStream = client
// //   .streamingRecognize(request)
// //   .on("error", console.error)
// //   .on("data", (data) => {
// //     console.log(`Transcription: ${JSON.stringify(data)}`);
// //     if (data.results[0].isFinal) {
// //       console.log("Done", data.results[0].alternatives[0].transcript);
// //     }
// //   });

// fs.createReadStream('./test.wav').pipe(recognizeStream);

// // Tạo luồng nhận dạng
// const recognizeStream = client
//   .streamingRecognize(request)
//   .on('error', console.error)
//   .on('data', data =>
//     process.stdout.write(
//       data.results[0] && data.results[0].alternatives[0]
//         ? `Transcription: ${data.results[0].alternatives[0].transcript}\n`
//         : '\n\nReached transcription time limit, press Ctrl+C\n',
//     ),
//   );
// // Bắt đầu ghi âm và gửi đầu vào micrô tới API giọng nói.
// // Đảm bảo SoX được cài đặt
// recorder
//   .record({
//     sampleRateHertz: sampleRateHertz,
//     threshold: 0,
//     // Các tùy chọn khác, xem https://www.npmjs.com/package/node-record-lpcm16#options
//     verbose: false,
//     recordProgram: 'rec',
//     silence: '10.0',
//   })
//   .stream()
//   .on('error', console.error)
//   .pipe(recognizeStream);

// console.log('Listening, press Ctrl+C to stop.');

const { GoogleSpeech } = require('./speech/google');

const test = new GoogleSpeech({ sessionId: '123', uuid: '123' });

fs.createReadStream('./audio_237.wav').pipe(test.recognizeStream);

// fs.readFile('./test_01.raw', function(err, data) {
//   if (err) throw err;
//   let count = 0;
//   for (var i = 0; i < data.length; i += 640) {
//     buffer = data.slice(i, Math.min(i + 640, data.length));
//     request = {
//       audio_content: buffer,
//     };
//     count += 1;

//     test.recognizeStream.write(request);
//   }
//   console.log('count', count);
//   test.recognizeStream.end();
// });
