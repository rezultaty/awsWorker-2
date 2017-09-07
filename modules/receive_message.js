var AWS = require('aws-sdk');
AWS.config.loadFromPath('./config.json');
var Const = require("./const");
var Jimp = require("jimp");
var sqs = new AWS.SQS({ apiVersion: Const.API_VERSION });
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

        sqs.receiveMessage(params, function (err, data) {

            if (err)
                Const.putIntoLogDB("Receive Error: " + err);
            else {
                if (data.Messages != null) {
                    data.Messages.forEach(function (value) {

                        const numberType = Number(value.MessageAttributes["MessageType"].StringValue);
                        deleteMessage(value.ReceiptHandle);

                        switch (numberType) {
                            case Const.DELETE_TYPE:
                                deletePhoto(JSON.parse(value.Body));
                                break;
                            case Const.ROTATE_TYPE:
                                rotateImage(JSON.parse(value.Body));
                                break;
                            case Const.SCALE_TYPE:
                                scaleImage(JSON.parse(value.Body));
                                break;
                        }

                    });
                }
            }
        });
    }
}, 5 * 1000);


function deleteMessage(receiptHandle) {

    var deleteParams = {
        QueueUrl: Const.messageQueue,
        ReceiptHandle: receiptHandle
    };

    sqs.deleteMessage(deleteParams, function (err, data) {
        if (err)
            Const.putIntoLogDB("Delete error: " + err);
    });

}

function deletePhoto(photoKey) {

    var params = { Bucket: Const.bucketName, Key: photoKey };

    s3.deleteObject(params, function (err, data) {
        if (err)
            Const.putIntoLogDB("Error while deleting local photo: " + err);
    });

}

function rotateImage(photoKey) {

    var urlParams = {Bucket: Const.bucketName, Key: photoKey};
    s3.getSignedUrl('getObject', urlParams, function (err, url) {

        Jimp.read(url, function (err, image) {
            if (err)
                Const.putIntoLogDB("Error read photo: " + err);

            image.rotate(90);
            image.getBuffer(image.getMIME(), (err, buffer) => {

                if (err)
                    Const.putIntoLogDB("Error while rotating photo: " + err);
                else {
                    
                    var newImageData = {
                        Bucket: Const.bucketName,
                        Key: Const.getUniqueSQSName(),
                        Body: String(buffer)
                    };

                    s3.putObject(newImageData, function (err, data) {
                        if (err)
                            Const.putIntoLogDB("Error uploading rotated photo: " + err);
                    });
                }

            });
        });
    });
}

function scaleImage(photoKey) {

    var urlParams = {Bucket: Const.bucketName, Key: photoKey};
    s3.getSignedUrl('getObject', urlParams, function (err, url) {
        Jimp.read(url, function (err, image) {
            if (err)
                Const.putIntoLogDB("Error read photo: " + err);

            image.scale(2, 2);
            image.getBuffer(image.getMIME(), (err, buffer) => {

                if (err)
                    Const.putIntoLogDB("Error while scaling photo: " + err);
                else {

                    var newImageData = {
                        Bucket: Const.bucketName,
                        Key: Const.getUniqueSQSName(),
                        Body: buffer
                    };

                    s3.putObject(newImageData, function (err, data) {
                        if (err)
                            Const.putIntoLogDB("Error uploading scaled photo: " + err);
                    });
                }

            });
        });
    });
}