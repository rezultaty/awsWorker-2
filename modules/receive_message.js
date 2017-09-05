var AWS = require('aws-sdk');
AWS.config.loadFromPath('./config.json');
var Const = require("./const");
var Jimp = require("jimp");
var sqs = new AWS.SQS({apiVersion: Const.API_VERSION});
var s3 = new AWS.S3();
var checkNewMessages = true;

var params = {
    AttributeNames: [
        "SentTimestamp"
    ],
    MaxNumberOfMessages: 1,
    MessageAttributeNames: [
        "All"
    ],
    QueueUrl: Const.messageQueue,
    VisibilityTimeout: 0,
    WaitTimeSeconds: 0
};

setInterval(function () {

    if (checkNewMessages) {
        var i = 0;

        sqs.receiveMessage(params, function (err, data) {
            if (err)
                console.log("Receive Error", err);
            else {
                if (data.Messages != null) {
                    console.log(data.Messages);
                    data.Messages.forEach(function (value) {
                        i++;

                        const numberType = Number(value.MessageAttributes["MessageType"].StringValue);

                        switch (numberType) {
                            case 1:
                                deletePhoto(JSON.parse(value.Body));
                                break;
                            case 2:
                                rotateImage(JSON.parse(value.Body));
                                break;
                            case 3:
                                scaleImage(JSON.parse(value.Body));
                                break;
                        }

                        //deleteMessage(value.ReceiptHandle);

                    });
                }
            }
        });
    }
}, 5 * 1000);

function deletePhoto(photoKey) {

    var params = {Bucket: Const.bucketName, Key: photoKey};

    s3.deleteObject(params, function (err, data) {
        if (err)
            console.log(err, err.stack);
    });

}


function deleteMessage(receiptHandle) {

    var deleteParams = {
        QueueUrl: Const.messageQueue,
        ReceiptHandle: receiptHandle
    };

    sqs.deleteMessage(deleteParams, function (err, data) {
        if (err)
            console.log("Delete Error", err);
    });

}

function rotateImage(photoKey) {

    var urlParams = {Bucket: Const.bucketName, Key: photoKey};
    s3.getSignedUrl('getObject', urlParams, function (err, url) {

        console.log(url);

        Jimp.read(url, function (err, image) {
            if (err)
                throw err;
            image.rotate(90);
            image.getBuffer(image.getMIME(), (err, buffer) => {
                var newImageData = {
                    Key: Const.getUniqueSQSName(),
                    Body: buffer
                };
                s3.putObject(newImageData, function (err, data) {
                    if (err)
                        console.log('Error uploading data: ', data);

                });

            });
        });

    });

}

function scaleImage(photoKey) {

    var urlParams = {Bucket: Const.bucketName, Key: photoKey};
    s3.getSignedUrl('getObject', urlParams, function (err, url) {
        Jimp.read(url, function (err, image) {
            if (err)
                throw err;
            image.scale(2, 2);
            image.getBuffer(image.getMIME(), (err, buffer) => {
                var newImageData = {
                    Key: Const.getUniqueSQSName(),
                    Body: buffer
                };
                s3.putObject(newImageData, function (err, data) {
                    if (err)
                        console.log('Error uploading data: ', data);

                });
            });

        });

    });

}