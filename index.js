/*
Developed by Ron Dagdag
Email: rlyle78@gmail.com

*/

var http = require('http');
// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = function (event, context) {
    try {
        console.log("event.session.application.applicationId=" + event.session.application.applicationId);

        /**
         * Uncomment this if statement and populate with your skill's application ID to
         * prevent someone else from configuring a skill that sends requests to this function.
         */
        /*
        if (event.session.application.applicationId !== "amzn1.echo-sdk-ams.app.[unique-value-here]") {
             context.fail("Invalid Application ID");
        }
        */

        if (event.session.new) {
            onSessionStarted({requestId: event.request.requestId}, event.session);
        }

        if (event.request.type === "LaunchRequest") {
            onLaunch(event.request,
                event.session,
                function callback(sessionAttributes, speechletResponse) {
                    context.succeed(buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === "IntentRequest") {
            onIntent(event.request,
                event.session,
                function callback(sessionAttributes, speechletResponse) {
                    context.succeed(buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === "SessionEndedRequest") {
            onSessionEnded(event.request, event.session);
            context.succeed();
        }
    } catch (e) {
        context.fail("Exception: " + e);
    }
};

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId +
        ", sessionId=" + session.sessionId);
}

/**
 * Called when the user launches the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    console.log("onLaunch requestId=" + launchRequest.requestId +
        ", sessionId=" + session.sessionId);

    // Dispatch to your skill's launch.
    getWelcomeResponse(callback);
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback) {
    console.log("onIntent requestId=" + intentRequest.requestId +
        ", sessionId=" + session.sessionId);

    var intent = intentRequest.intent,
        intentName = intentRequest.intent.name;

    // Dispatch to your skill's intent handlers
    if ("MyZipCodeIsIntent" === intentName) {
        setZipCodeInSession(intent, session, callback);
    } else if ("RepresentativeIntent" === intentName) {
        getRepresentativeFromSession(intent, session, callback);
    } else if ("AMAZON.HelpIntent" === intentName) {
        getWelcomeResponse(callback);
    } else if ("AMAZON.StopIntent" === intentName || "AMAZON.CancelIntent" === intentName) {
        handleSessionEndRequest(callback);
    } else {
        throw "Invalid intent";
    }
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
    console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId +
        ", sessionId=" + session.sessionId);
    // Add cleanup logic here
}

// --------------- Functions that control the skill's behavior -----------------------

function getWelcomeResponse(callback) {
    // If we wanted to initialize the session to have some attributes we could add those here.
    var sessionAttributes = {};
    var cardTitle = "Welcome";
    var speechOutput = "Who is my representative? " +
        "Please tell me your zip code";
    // If the user either does not reply to the welcome message or says something that is not
    // understood, they will be prompted again with this text.
    var repromptText = "Please tell me your zip code by saying, " +
        "my zip code is 9 0 2 1 0";
    var shouldEndSession = false;

    callback(sessionAttributes,
        buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

function handleSessionEndRequest(callback) {
    var cardTitle = "Session Ended";
    var speechOutput = "Thank you. Please Vote!";
    // Setting this to true ends the session and exits the skill.
    var shouldEndSession = true;

    callback({}, buildSpeechletResponse(cardTitle, speechOutput, null, shouldEndSession));
}


function setZipCodeInSession(intent, session, callback) {
    var cardTitle = intent.name;
    var locationSlot = intent.slots.Location;
    var repromptText = "";
    var sessionAttributes = {};
    var shouldEndSession = false;
    var speechOutput = "";

    if (locationSlot) {
        var zipcode = locationSlot.value;
        sessionAttributes = createZipCodeAttributes(zipcode);
        speechOutput = "I now know your zip code is " + zipcode.split('').join(' ') + ". You can ask me " +
            "who is my representative?";
        repromptText = "You can ask me who is my representative?";

    } else {
        speechOutput = "I'm not sure what your zip code is. Please try again";
        repromptText = "I'm not sure what your zip code is. You can tell me your " +
            "zip code by saying, my zip code is 9 0 2 1 0";
    }

    callback(sessionAttributes,
         buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

function createZipCodeAttributes(myzipcode) {
    return {
        zipCode: myzipcode
    };
}

function getRepresentativeFromSession(intent, session, callback) {
    var zipcode;
    var repromptText = null;
    var sessionAttributes = {};
    var shouldEndSession = false;
    var speechOutput = "";

    if (session.attributes) {
        zipcode = session.attributes.zipCode;
    }


    if (intent.slots) {
        var locationSlot = intent.slots.Location;
        if (locationSlot.value){
            zipcode = locationSlot.value;
            //sessionAttributes = createZipCodeAttributes(zipcode);
        }
    }
    console.log('zip code :' + zipcode)
    if (zipcode) {
        //http://whoismyrepresentative.com/getall_mems.php?zip=75034
        shouldEndSession = true;

        getRepresentative(zipcode, function(reps){
                //list all the names of state representative

                var totalReps = Object.keys(reps.results).length;
                var repNames = "";
                for ( var i = 0; i < totalReps; i++)
                {
                    rep = reps.results[i]
                    console.log("Name: " + rep.name);
                    repName = rep.name
                    if (rep.district.indexOf('Seat') > 0)
                        repName = 'Senator ' + repName
                    if (i == totalReps - 1)
                        repNames = repNames + ' and ' + repName
                    else
                        repNames = repNames + repName + ', '
                }
                if (totalReps > 1)
                    speechOutput = "Your representatives are " + repNames + '.';
                else
                    speechOutput = "Your representative is " + repNames + ".";
                callback(sessionAttributes,
                    buildSpeechletResponse(intent.name, speechOutput, repromptText, shouldEndSession));

        });

    } else {
        speechOutput = "I'm not sure what your zip code is, you can say, my zip code " +
            " is 9 0 2 1 0";
        callback(sessionAttributes,
         buildSpeechletResponse(intent.name, speechOutput, repromptText, shouldEndSession));
    }

    // Setting repromptText to null signifies that we do not want to reprompt the user.
    // If the user does not respond or says something that is not understood, the session
    // will end.

}

function getRepresentative(zipcode, callback) {

    return http.get({
        host: 'whoismyrepresentative.com',
        path: '/getall_mems.php?zip=' + zipcode + '&output=json'
    }, function(response) {
        // Continuously update stream with data
        var body = '';
        response.on('data', function(d) {
            body += d;
        });
        response.on('end', function() {

            // Data reception is done, do whatever with it!
            var parsed = JSON.parse(body);
            callback(parsed);
        });
    });
}

// --------------- Helpers that build all of the responses -----------------------

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        card: {
            type: "Simple",
            title: "SessionSpeechlet - " + title,
            content: "SessionSpeechlet - " + output
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    };
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: "1.0",
        sessionAttributes: sessionAttributes,
        response: speechletResponse
    };
}
