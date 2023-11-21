const AWS = require('aws-sdk');

const bucket = "efitter-test-metrics-bucket";
console.log(bucket)
const s3 = new AWS.S3();
var params = {
    Bucket: bucket,
    Key : ""+Date.now(),
    Body : "EVENT: \n" + JSON.stringify({ a:1}, null, 2),
}
s3.putObject(params, function(err, data) {
  if (err) console.log(err, err.stack); // an error occurred
  else     console.log(data);           // successful response
});
