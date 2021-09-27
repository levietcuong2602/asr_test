const fs = require("fs");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

const PROTO_PATH = "./stt_vais_service.proto";

const options = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};
const packageDefinition = protoLoader.loadSync(PROTO_PATH, options);
const vaisService = grpc.loadPackageDefinition(packageDefinition).vais.cloud
  .speech.v1;

function VaisSpeech() {
  this.runSendVoice();
}

VaisSpeech.prototype.runSendVoice = function () {
  const endpoint = "asr-telephone-fast.vais.vn:80";
  const client = new vaisService.Speech(
    endpoint,
    grpc.credentials.createInsecure()
  );
  console.log("endpoint", endpoint);
  const meta = new grpc.Metadata();
  meta.add(
    "api-key",
    "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJydCI6MTU0NTcwNTE1MCwidWlkIjoiNWJjYjAzYjc1ODY1OTEwMDA5ZDlmMzM3In0.Sxx3h_tT7fnFiGx-7qUitBRhdOm6FV9YwvcaSugKq6k"
  );

  this.call = client.StreamingRecognize(meta);

  this.call.on("data", function (response) {
    const results = response.results;
    console.log(JSON.stringify(response));
    if (results.length != 0) {
      const text = results[0].alternatives[0].transcript.trim();
      const is_final = results[0].is_final;
      console.log(text);
      console.log(is_final);
      if (is_final) {
        test.call.end();
      }
    }
  });
  this.call.on("end", function (event) {
    console.log("end");
  });

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
  this.call.write(xrequest);
};

const test = new VaisSpeech();

fs.readFile("./test_01.raw", function (err, data) {
  if (err) throw err;
  let count = 0;
  for (var i = 0; i < data.length; i += 640) {
    buffer = data.slice(i, Math.min(i + 640, data.length));
    request = {
      audio_content: buffer,
    };
    count += 1;

    test.call.write(request);
  }
  console.log("count", count);
  test.call.end();
});
