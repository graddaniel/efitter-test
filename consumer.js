import AWS from 'aws-sdk';

const s3 = new AWS.S3();

export const handler = async (event) => {
  const parsedRecords = parseRecords(event.Records);

  const {
    succesfullyProcessedRecords,
    processingFailures,
  } = filterParsedRecords(parsedRecords);
  
  await updateS3Objects(
    succesfullyProcessedRecords,
    processingFailures,
  );

  const response = {
    statusCode: 200,
    body: `Succesfully processed ${succesfullyProcessedRecords.length} data entries`,
  };
  
  return response;
};

function parseRecords (records) {
  return records.map(record => {
    try {
      const {
        timestamp,
        name,
        value,
      } = JSON.parse(record.body);
      
      if (!timestamp || !name || !value) {
        return {
          failed: true,
          body: record.body,
          reason: "Incorrect metric format",
        };
      }
      
      return {
        timestamp,
        name,
        value,
      };
    } catch (error) {
      return {
        failed: true,
        body: record.body,
        reason: error.message,
      };
    }
  });
}

function filterParsedRecords (records) {
  return records.reduce((acc, cur) => {
    if (cur.failed) {
      acc.processingFailures.push(cur);
    } else {
      acc.succesfullyProcessedRecords.push(cur);
    }
    
    return acc;
  }, {
    succesfullyProcessedRecords: [],
    processingFailures: [],
  });
}

async function updateS3Objects(
  succesfullyProcessedRecords,
  processingFailures,
) {
  if (succesfullyProcessedRecords.length > 0) {
    // metrics other than memory usage are ignored for now
    await appendS3Object(
      process.env.BUCKET_NAME,
      process.env.MEMORY_CONSUMPTION_METRICS_OBJECT_KEY,
      succesfullyProcessedRecords
        .filter(record => record.name === 'memory.usage')
        .map(record => `${record.timestamp}: ${record.value}`)
        .join('\n') + '\n',
    );
  }
  
  if (processingFailures.length > 0) {
    await appendS3Object(
      process.env.BUCKET_NAME,
      process.env.FAULTY_METRICS_OBJECT_KEY,
      processingFailures
        .map(failure => `${failure.reason}: ${failure.body}`)
        .join('\n') + '\n',
    );
  }
}

async function appendS3Object(
  bucketName,
  objectKey,
  dataString,
) {
  const currentObjectData = await getObjectFromS3(
    bucketName,
    objectKey,
  );
  
  await putObjectToS3(
    bucketName,
    objectKey,
    currentObjectData.Body.toString() + dataString,
  );
}

async function getObjectFromS3(bucketName, key) {
  return new Promise((resolve, reject) => {
    const params = {
        Bucket : bucketName,
        Key : key,
    }

    s3.getObject(params, function(err, data) {
      if (err) {
        console.log(err, err.stack);
        reject(err);
      } else {
        console.log(data);
        resolve(data);
      }
    });
  });
}

function putObjectToS3(bucketName, key, data){
  return new Promise((resolve, reject) => {
    const params = {
        Bucket : bucketName,
        Key : key,
        Body : data,
    }

    s3.putObject(params, function(err, data) {
      if (err) {
        console.log(err, err.stack);
        reject(err);
      } else {
        console.log(data);
        resolve(data);
      }
    });
  });
}