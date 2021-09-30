const stopRecognizeTimeout = (speech, timeout) => {
  if (speech) return null;
  return setTimeout(() => {
    speech.stopRecognizeTimeout();
  }, timeout);
};

module.exports = { stopRecognizeTimeout };
