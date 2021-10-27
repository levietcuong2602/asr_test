const path = require('path');
const protoLoader = require('@grpc/proto-loader');
const grpc = require('@grpc/grpc-js');
const PROTO_PATH = path.join(__dirname, './lib/stt_vbee_service.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const speech = grpc.loadPackageDefinition(packageDefinition).vbee.stt.v1;

const fs = require('fs');
var async = require('async');

const xrequest = {
  config: {
    specification: {
      model: 'Wav2vec2',
      record: false,
      partial_results: true,
      single_utterance: true,
      interim_results: false,
      config_audio: {
        encoding: 1,
        max_alternatives: 1,
        session_id: 'ABC12312313',
        sample_rate_hertz: 16000,
      },
    },
  },
};

function VbeeSpeech() {
  this.runSendVoice();
}

VbeeSpeech.prototype.runSendVoice = function() {
  const meta = new grpc.Metadata();
  meta.add('api-key', '6FV9YwvcaSugKq6k');

  const endpoint = '0.tcp.ngrok.io:16055';
  const client = new speech.SttService(
    endpoint,
    grpc.credentials.createInsecure(),
  );
  this.call = client.StreamingRecognize(meta);

  this.call.on('data', function(response) {
    const results = response.results;
    console.log('results', JSON.stringify(response));
  });

  this.call.on('end', function(event) {
    console.log('end');
  });

  console.log('INIT vbee speech', JSON.stringify(xrequest));
  this.call.write(xrequest);
};

const test = new VbeeSpeech({});

const audioDataStream = fs.createReadStream(
  path.join(__dirname, './audio_237.wav'),
  {
    highWaterMark: 320,
  },
);
audioDataStream.on('data', chunk => {
  test.call.write({ audio_content: chunk });
});

audioDataStream.on('end', () => {
  test.call.end();
});
