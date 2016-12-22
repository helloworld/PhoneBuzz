var twilio = require("twilio");

function validateTwilioRequest(req, url) {
	return twilio.validateExpressRequest(req, process.env.TWILO_AUTH_TOKEN, { url: url });
}

module.exports = validateTwilioRequest;