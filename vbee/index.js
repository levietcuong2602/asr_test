const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");
const _ = require("lodash");

require("dotenv").config();

const PROTO_PATH = path.join(__dirname, "./stt_vbee_service.proto");
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const speech = grpc.loadPackageDefinition(packageDefinition).vbee.stt.v1;
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

  const endpoint = process.env.VBEE_ENDPOINT;
  console.log({ endpoint });
  const client = new speech.SttService(
    endpoint,
    grpc.credentials.createInsecure()
  );
  // this.call = client.Recognize(function (error, response) {
  //   console.log("successfully : ", response);
  // });
  this.recognizeStream = client.StreamingRecognize(meta);

  this.recognizeStream.on("data", function (response) {
    const results = response.results;
    console.log("results", JSON.stringify(response));
  });

  this.recognizeStream.on("end", function (event) {
    console.log("end");
  });

  this.recognizeStream.write({ config: xrequest });
};

module.exports = { VbeeSpeech };
