// consumer.js
const amqplib = require('amqplib');
const log4js = require('log4js');
const logger = log4js.getLogger('Consumer');

const QUEUE = 'emailsQueue'; // Same queue name as the producer
const connectionString = 'amqp://<user>:<password>@<host>:<port>'

const consumeEmailMessages = async () => {
    try {
        // Connect to RabbitMQ
        const connection = await amqplib.connect(connectionString);
        const channel = await connection.createChannel();

        // Assert the queue (make sure it exists)
        await channel.assertQueue(QUEUE, {
            durable: true,
        });

        // Consume messages from the queue
        channel.consume(QUEUE, (message) => {
            if (message) {
                const emailData = JSON.parse(message.content.toString());
                console.info(`Received email data: ${JSON.stringify(emailData)}`);

                //send Email using nodemailer

                channel.ack(message);
            }
        });

        console.info('Waiting for messages in the queue...');
    } catch (error) {
        console.error('Error in consuming message from RabbitMQ:', error);
    }
};

consumeEmailMessages();
