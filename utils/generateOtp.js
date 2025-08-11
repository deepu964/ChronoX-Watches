function generateOtp() {
  return `${Math.floor(Math.random() * 10000)}`.padStart(4, '0');
}

module.exports = generateOtp;
