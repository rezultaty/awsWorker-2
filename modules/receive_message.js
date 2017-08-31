const bucketName = "psoirphotobucket";
const queueURL = "https://sqs.eu-west-2.amazonaws.com/953234601553/RutkowskiQueue";
var BreakException = {};

// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
// Load credentials and set the region from the JSON file
AWS.config.loadFromPath('./config.json');

// Create an SQS service object
var sqs = new AWS.SQS({apiVersion: '2017-08-30'});

var params = {
    AttributeNames: [
        "SentTimestamp"
    ],
    MaxNumberOfMessages: 1,
    MessageAttributeNames: [
        "All"
    ],
    QueueUrl: queueURL,
    VisibilityTimeout: 0,
    WaitTimeSeconds: 0
};

sqs.receiveMessage(params, function (err, data) {
    if (err) {
        console.log("Receive Error", err);
    } else {
        const numberType = Number(data.Messages[0].MessageAttributes["MessageType"].StringValue);

        switch (numberType) {
            case 1:
                deletePhoto(JSON.parse(data.Messages[0].Body), data.Messages[0].ReceiptHandle);
                break;
        }

    }
});

function deletePhoto(photos, receiptHandle) {
    var s3 = new AWS.S3();
    deleteMessage(receiptHandle);
    let messageDelete = false;

    photos.forEach(function (element) {

        var params = {Bucket: bucketName, Key: element};

        try {
            s3.deleteObject(params, function (err, data) {
                if (err) {
                    console.log(err, err.stack);
                    throw BreakException;
                }
                else {
                    console.log();
                    messageDelete = true
                }
            });
        } catch (e) {
            if (e !== BreakException) throw e;
            else messageDeleted = false;
        }

        if (messageDelete)
            deleteMessage(receiptHandle);
    });


}


function deleteMessage(receiptHandle) {

    var deleteParams = {
        QueueUrl: queueURL,
        ReceiptHandle: receiptHandle
    };

    sqs.deleteMessage(deleteParams, function (err, data) {
        if (err) {
            console.log("Delete Error", err);
        } else {
            console.log("Message Deleted", data);
        }
    });

}