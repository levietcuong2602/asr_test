const fs = require("fs");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

const PROTO_PATH = "./stt_vbee_service.proto";
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const sttProto = grpc.loadPackageDefinition(packageDefinition).vbee.stt.v1;
const xrequest = {
  specification: {
    model: "Wav2vec2",
    record: false,
    partial_results: true,
    single_utterance: true,
    interim_results: false,
  },
};

function VbeeSpeech() {
  this.runSendVoice();
}

VbeeSpeech.prototype.runSendVoice = function () {
  const meta = new grpc.Metadata();
  meta.add("api-key", "6FV9YwvcaSugKq6k");

  // client.StreamingRecognitionRequest(xrequest);
  // const call = client.Recognize();

  const endpoint = "0.tcp.ngrok.io:16055";
  const client = new sttProto.SttService(
    endpoint,
    grpc.credentials.createInsecure()
  );
  // this.call = client.Recognize(function (error, response) {
  //   console.log("successfully : ", response);
  // });
  this.call = client.StreamingRecognize(meta);

  this.call.on("data", function (response) {
    const results = response.results;
    console.log("results", JSON.stringify(response));
  });

  this.call.on("end", function (event) {
    console.log("end");
  });

  this.call.write({ config: xrequest });
};

const test = new VbeeSpeech();

const audioDataStream = fs.createReadStream("./audio_237.wav", {
  highWaterMark: 320,
});
audioDataStream.on("data", (chunk) => {
  test.call.write({ audio_content: chunk });
});

audioDataStream.on("end", () => {
  test.call.end();
});

// fs.readFile("./test_01.raw", function (err, data) {
//   if (err) throw err;
//   let count = 0;
//   for (var i = 0; i < data.length; i += 640) {
//     buffer = data.slice(i, Math.min(i + 640, data.length));
//     request = {
//       audio_content: buffer,
//     };
//     count += 1;

//     test.call.write(request);
//   }
//   console.log("count", count);
//   test.call.end();
// });
