const fs = require("fs");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const _ = require("lodash");
const path = require("path");
require("dotenv").config();

const PROTO_PATH = path.join(__dirname, "../lib/stt_vais_service.proto");

const options = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};
const packageDefinition = protoLoader.loadSync(PROTO_PATH, options);
const speech = grpc.loadPackageDefinition(packageDefinition).vais.cloud.speech
  .v1;

const xrequest = {
  streaming_config: {
    single_utterance: true,
    interim_results: true,
    partial_results: true,
    config: {
      encoding: 1,
      max_alternatives: 1,
      session_id: "ABC12312313",
      sample_rate_hertz: 8000,
      speech_contexts: [
        {
          phrases: [],
        },
      ],
    },
  },
};

function VaisSpeech() {
  this.connect();
}

VaisSpeech.prototype.connect = function () {
  const endpoint = "asr-telephone-fast.vais.vn:80";
  console.log("endpoint", endpoint);
  const client = new speech.Speech(endpoint, grpc.credentials.createInsecure());
  const meta = new grpc.Metadata();
  meta.add(
    "api-key",
    "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJydCI6MTU0NTcwNTE1MCwidWlkIjoiNWJjYjAzYjc1ODY1OTEwMDA5ZDlmMzM3In0.Sxx3h_tT7fnFiGx-7qUitBRhdOm6FV9YwvcaSugKq6k"
  );

  this.recognizeStream = client
    .StreamingRecognize(meta)
    .on("data", function (response) {
      const results = response.results;
      console.log(JSON.stringify(response));
      if (results.length != 0) {
        const text = results[0].alternatives[0].transcript.trim();
        const is_final = results[0].is_final;
        console.log(text);
        console.log(is_final);
      }
    })
    .on("error", function (err) {
      console.log("error: ", err);
    })
    .on("end", function () {
      console.log("end");
    });

  this.recognizeStream.write(xrequest);
};

VaisSpeech.prototype.close = function () {
  console.log(`VaisSpeech close_speech_recognize`);
  if (this.recognizeStream) {
    this.recognizeStream.end();
    this.recognizeStream = null;
  }
};

module.exports = { VaisSpeech };
