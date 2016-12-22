var express = require("express");
var twilio = require('twilio');
var bodyParser = require('body-parser');
var compress = require('compression');
var qs = require('querystring');
var path = require('path');
var dotenv = require('dotenv');
var Queue = require('bull');

dotenv.load();

var fizzbuzz = require("./fizzbuzz");
var validateTwilioRequest = require("./validateTwilioRequest");
var callQueue = Queue('make call', process.env.REDIS_PORT, process.env.REDIS_URL);
var Datastore = require('nedb'),
    db = new Datastore({ filename: 'database.data', autoload: true, timestampData: true });

var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(compress());
app.use(express.static(path.join(__dirname, 'public')));

var client = twilio(process.env.TWILIO_SID, process.env.TWILO_AUTH_TOKEN);

app.post("/twilio/start", function(req, res) {
    // Check if Twilio is sending the request
    if (!validateTwilioRequest(req, process.env.WEBHOOK_URL + "/twilio/start")) {
        return res.status(403).send('Forbidden');
    }

    // Generate Twiml
    var resp = new twilio.TwimlResponse();
    resp.say({}, 'Welcome to Phone Buzz!');

    // Gather a number 
    resp.gather({
        timeout: 30,
        finishOnKey: "#",
        // Post the number to the /fizzbuzz route
        action: "/twilio/fizzbuzz"
    }, function() {
        this.say('Enter a number, and then press the pound sign.');
    });

    // Send the Twiml as response
    res.writeHead(200, {
        'Content-Type': 'text/xml'
    });
    res.end(resp.toString());
});

app.post("/twilio/fizzbuzz", function(req, res) {
    // Check if Twilio is sending the request
    if (!validateTwilioRequest(req, process.env.WEBHOOK_URL + "/twilio/fizzbuzz")) {
        return res.status(403).send('Forbidden');
    }

    var resp = new twilio.TwimlResponse(),
        digits = req.body.Digits;

    // If digits were sent and they are a number
    if (digits && parseInt(digits)) {
        // Generate the fizzbuzz string and Say it
        var fizzBuzzString = fizzbuzz(parseInt(digits)).join(" ")
        resp.say({}, fizzBuzzString);
    } else {
        // Else, something went wrong. Redirect to initial route.
        resp.redirect('/');
    }

    // Send the Twiml as a response
    res.writeHead(200, {
        'Content-Type': 'text/xml'
    });
    res.end(resp.toString());
});

app.post("/twilio/fizzbuzz/:number", function(req, res) {
    // Check if Twilio is sending the request
    if (!validateTwilioRequest(req, process.env.WEBHOOK_URL + "/twilio/fizzbuzz/" + req.params.number)) {
        return res.status(403).send('Forbidden');
    }

    // Generate Twiml
    var resp = new twilio.TwimlResponse(),
        digits = req.params.number;

    // If digits were sent and they are a number
    if (digits && parseInt(digits)) {
        // Generate the fizzbuzz string and say it
        var fizzBuzzString = fizzbuzz(parseInt(digits)).join(" ")
        resp.say({}, fizzBuzzString);
    } else {
        // Else, something went wrong. Redirect to initial route.
        resp.redirect('/');
    }

    // Send the Twiml as a response
    res.writeHead(200, {
        'Content-Type': 'text/xml'
    });
    res.end(resp.toString());
});


// Process for delayed calls
callQueue.process(function(job, done) {
    var data = job.data;
    client.makeCall({
        to: data.phonenumber,
        from: process.env.PHONE_NUMBER,
        url: process.env.WEBHOOK_URL + "/twilio/fizzbuzz/" + data.number,
    }, function(err, responseData) {
        done();
    });
});

app.post("/makecall", function(req, res) {
    var data = req.body;

    // If delay is greater than 0 seconds, queue the call
    if (data.delay > 0) {
        callQueue.add(data, { delay: data.delay * 1000 });
        db.insert({
            to: data.phonenumber,
            number: data.number,
            delay: data.delay,
        }, function() {
            res.send("success");
        });
    } else {
        // Make the call
        client.makeCall({
            to: data.phonenumber,
            from: process.env.PHONE_NUMBER,
            url: process.env.WEBHOOK_URL + "/twilio/fizzbuzz/" + data.number,
        }, function(err, responseData) {
            // Add call to database
            db.insert({
                to: data.phonenumber,
                number: data.number,
                delay: data.delay,
            }, function() {
                res.send("success")
            });
        });
    }
});

app.get("/getcalls", function(req, res) {
    // Return all calls in sorted order
    db.find({}).sort({ createdAt: -1 }).exec(function(err, docs) {
        res.send(docs);
    });
});

app.listen(3000, function() {
    console.log('Express server listening on port ' + 3000);
});
