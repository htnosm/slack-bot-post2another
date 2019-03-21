'use strict';

const AWS = require('aws-sdk');
const url = require('url');
const https = require('https');

// The base-64 encoded, encrypted key (CiphertextBlob) stored in the kmsEncryptedHookUrl environment variable
const kmsEncryptedHookUrl = process.env.kmsEncryptedHookUrl;
// The Slack channel to send a message to stored in the slackChannel environment variable
const slackChannel = process.env.slackChannel;
const slackIconEmoji = process.env.slackIconEmoji;
const slackUserName = process.env.slackUserName;
let hookUrl;

function postMessage(message, callback) {
  const body = JSON.stringify(message);
  const options = url.parse(hookUrl);
  options.method = 'POST';
  options.headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  };

  const postReq = https.request(options, (res) => {
    const chunks = [];
    res.setEncoding('utf8');
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => {
      if (callback) {
        callback({
          body: chunks.join(''),
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
        });
      }
    });
    return res;
  });

  postReq.write(body);
  postReq.end();
}

function processEvent(event, callback) {

  console.log('event: ' + JSON.stringify(event));
  var body = event.body;
  if (body == null) {
    callback('Message Body has not been set.');
    return;
  };

  var text = {};
  body.split('&').forEach( function( value ) {
    var values = value.split('=');
    text[values[0]] = values[1];
  });
  console.log('body: ' + JSON.stringify(text));
  var result_text = text['text'].replace(text['trigger_word'],'').replace(/\+/g, '%20');
  var message = decodeURIComponent('> ' + text['user_name'] + ' in #' + text['channel_name'] + '\n' + result_text + '\n');
  console.log('slack message: ' + message);

  const slackMessage = {
    channel: slackChannel,
    text: message,
    icon_emoji: slackIconEmoji,
    username: slackUserName,
  };

  postMessage(slackMessage, (response) => {
    if (response.statusCode < 400) {
      var res = {
        statusCode: response.statusCode,
        body: 'Message posted successfully'
      };
      console.info(res);
      callback(null, res);
    } else if (response.statusCode < 500) {
      console.error(`Error posting message to Slack API: ${response.statusCode} - ${response.statusMessage}`);
      callback(null);  // Don't retry because the error is due to a problem with the request
    } else {
      // Let Lambda retry
      callback(`Server error when processing message: ${response.statusCode} - ${response.statusMessage}`);
    }
  });
}

module.exports.post = (event, context, callback) => {
  if (hookUrl) {
    // Container reuse, simply process the event with the key in memory
    processEvent(event, callback);
  } else if (kmsEncryptedHookUrl && kmsEncryptedHookUrl !== '<kmsEncryptedHookUrl>') {
    const encryptedBuf = new Buffer(kmsEncryptedHookUrl, 'base64');
    const cipherText = { CiphertextBlob: encryptedBuf };

    const kms = new AWS.KMS();
    kms.decrypt(cipherText, (err, data) => {
      if (err) {
        console.log('Decrypt error:', err);
        return callback(err);
      }
      hookUrl = `https://${data.Plaintext.toString('ascii')}`;
      processEvent(event, callback);
    });
  } else {
    callback('Hook URL has not been set.');
  }
};
