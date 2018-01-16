var AWS = require('aws-sdk');
AWS.config.loadFromPath('./config.json');
var Const = require("./const");
var Jimp = require("jimp");
var sqs = new AWS.SQS({apiVersion: Const.API_VERSION});
var s3 = new AWS.S3();

var params = {
    MaxNumberOfMessages: 10,
    QueueUrl: Const.messageQueue,
    VisibilityTimeout: 10,
    WaitTimeSeconds: 0,
    AttributeNames: [
        "All"
    ],
    MessageAttributeNames: [
        'All'
    ]
};

var receiveMessages = function () {
    console.log("test");
    sqs.receiveMessage(params, function (err, data) {

        if (err)
            Const.putIntoLogDB("Receive Error: " + err);
        else {

            if (data.Messages) {
                data.Messages.forEach(function (value) {

                    if (Number(value["Attributes"].ApproximateReceiveCount) <= 5) {

                        const numberType = value.MessageAttributes["MessageType"].StringValue;

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

                        var deleteParams = {
                            QueueUrl: Const.messageQueue,
                            ReceiptHandle: value.ReceiptHandle
                        };

                        sqs.deleteMessage(deleteParams, function (err, data) {
                            if (err)
                                Const.putIntoLogDB("Delete error: " + err);
                        });
                    }

                });
                receiveMessages();

            } else {
                setTimeout(function () {
                    receiveMessages()
                }, Const.receiveInterval);
            }
        }
    });

};

function deletePhoto(photoKey) {

    var params = {Bucket: Const.bucketName, Key: photoKey};

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
                        Body: buffer
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

            image.scale(5);
            image.getBuffer(image.getMIME(), (err, buffer) => {

                if (err)
                    Const.putIntoLogDB("Error while rotating photo: " + err);
                else {

                    var newImageData = {
                        Bucket: Const.bucketName,
                        Key: Const.getUniqueSQSName(),
                        Body: buffer
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

receiveMessages();