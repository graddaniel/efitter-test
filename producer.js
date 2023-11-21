require('dotenv').config();
const AWS = require('aws-sdk');
const os = require('os');

const AWS_REGION = 'eu-central-1';
const SQS_API_VERSION = '2012-11-05';
const QUEUE_URL = "https://sqs.eu-central-1.amazonaws.com/432738040502/metrics.fifo";
const MESSAGE_GROUP_ID = 'memoryUsageMetrics';
const METRIC_CAPTURE_INTERVAL_MS = 5000;

class SQSAdapter {
	constructor ({
		queueUrl,
		messageGroupId,
	}) {
		AWS.config.update({
			region: AWS_REGION,
		});

		this._sqs = new AWS.SQS({
			apiVersion: SQS_API_VERSION,
		});

		this._queueUrl = queueUrl;
		this._messageGroupId = messageGroupId;
		this._lastDeduplicationId = 0;
	}

	sendMessage = async (message) => {
		return new Promise((resolve, reject) => {
			this._sqs.sendMessage({
				MessageGroupId: this._messageGroupId,
				MessageBody: message,
				QueueUrl: this._queueUrl,
				MessageDeduplicationId: "" + this._lastDeduplicationId,
			}, (err, data) => {
				if (err) {
					return reject(err);
				}

				console.log("Message sent");

				this._lastDeduplicationId += 1;

				return resolve(data);
			})
		})
	}
}

class Application {
	constructor (sqsAdapter) {
		this._sqsAdapter = sqsAdapter;
		this._intervalId = null;
	}

	start = () => {
		if (this._intervalId !== null) {
			console.error("Application is already started. Ignoring.");
		}

		this._intervalId = setInterval(this.captureMetrics, METRIC_CAPTURE_INTERVAL_MS);
	}

	captureMetrics = async () => {
		try {
			const totalMemory = os.totalmem();
			const freeMemory = os.freemem();

			const memoryUsagePercentage = Math.floor((totalMemory - freeMemory) / totalMemory * 100);
			await this._sqsAdapter.sendMessage(JSON.stringify({
				timestamp: Date.now(),
				name: 'memory.usage',
				value: memoryUsagePercentage,
			}));
		} catch (error) {
			console.error(`Failed to send SQS message: ${error.message}`);
		}
	}
}

const sqsAdapter = new SQSAdapter({
	queueUrl: QUEUE_URL,
	messageGroupId: MESSAGE_GROUP_ID,
});

const app = new Application(sqsAdapter);

app.start();

