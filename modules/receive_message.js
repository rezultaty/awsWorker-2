const Jimp = require("jimp");
const bucketName = "psoirphotobucket";
const queueURL = "https://sqs.eu-west-2.amazonaws.com/953234601553/RutkowskiQueue";
var BreakException = {};
var AWS = require('aws-sdk');
AWS.config.loadFromPath('./config.json');
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
            case 2:
                rotateImage(JSON.parse(data.Messages[0].Body), data.Messages[0].ReceiptHandle);
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

function rotateImage(photos, receiptHandle) {

    var counter = 0;

    photos['photos'].forEach(function (element) {

        Jimp.read("https://s3.eu-west-2.amazonaws.com/psoirphotobucket/" + element, function (err, image) {
            if (err)
                throw err;
            image.rotate( 90 );
            try {
                image.getBuffer(image.getMIME(), (err, buffer) => {
                    var s3Bucket = new AWS.S3({params: {Bucket: bucketName}});
                    var newName = hasObject(element.Key, s3Bucket, 1);
                    var data = {Key: newName, Body: buffer};
                    s3Bucket.putObject(data, function (err, data) {
                        if (err) {
                            console.log('Error uploading data: ', data);

                        } else {


                            counter++;
                            if (counter == photos.length - 1)
                                deleteMessage(receiptHandle);
                        }
                    });

                });
            } catch (e) {
                if (e !== BreakException)
                    throw e;
                else
                deleteMessage(receiptHandle);
            }
        });
    });

}

function hasObject(key, s3, namePropositionIterator) {

    var params = {
        Bucket: bucketName,
        Key: key + namePropositionIterator
    };

    s3.headObject(params, function (err, metadata) {
        if (err && err.code === 'NotFound') {
            hasObject(key, s3, namePropositionIterator++)
        } else {
            return key + namePropositionIterator;
        }
    });

}